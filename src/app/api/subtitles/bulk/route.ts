import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabase, getBucket } from "@/lib/supabase";
import crypto from "node:crypto";

/*
  POST /api/subtitles/bulk

  Uploads multiple .srt files and auto-matches them to episodes.
  The files should be named like: 5920_S1E1.srt, 5920_S1E2.srt, etc.
  The system parses the filename to find the TMDB ID + season + episode,
  then saves the subtitle URL on the matching episode.

  Form data:
    files: File[] (multiple .srt files)
    seriesId: string (optional — if provided, all files match to this series)
*/
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const form = await req.formData();
    const seriesId = String(form.get("seriesId") || "");
    const files = form.getAll("files");

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided." }, { status: 400 });
    }

    const supabase = getSupabase();
    const bucket = getBucket();

    const results: { filename: string; matched: boolean; episode?: string; error?: string }[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;

      const filename = file.name;
      const ext = filename.split(".").pop()?.toLowerCase();
      if (ext !== "srt" && ext !== "vtt") {
        results.push({ filename, matched: false, error: "Not .srt or .vtt" });
        continue;
      }

      // Parse filename to extract TMDB ID + season + episode
      // Expected patterns: 5920_S1E1.srt, 5920_S01E01.srt, the-mentalist_S1E1.srt
      const match = filename.match(/(\d+)[_-]?S(\d+)E(\d+)/i);
      let tmdbId: number | null = null;
      let season: number | null = null;
      let episode: number | null = null;

      if (match) {
        tmdbId = Number(match[1]);
        season = Number(match[2]);
        episode = Number(match[3]);
      } else {
        // Try just S##E## pattern
        const epMatch = filename.match(/S(\d+)E(\d+)/i);
        if (epMatch) {
          season = Number(epMatch[1]);
          episode = Number(epMatch[2]);
        }
      }

      // Find the episode in the database
      let dbEpisode = null;

      if (season != null && episode != null) {
        if (tmdbId) {
          // Find series by TMDB ID, then find episode
          const series = await db.movie.findFirst({ where: { tmdbId, type: "series" } });
          if (series) {
            dbEpisode = await db.episode.findFirst({
              where: { seriesId: series.id, season, episode },
            });
          }
        } else if (seriesId) {
          // Use provided seriesId
          dbEpisode = await db.episode.findFirst({
            where: { seriesId, season, episode },
          });
        }
      }

      // Also try matching as a movie subtitle (no season/episode in filename)
      if (!dbEpisode && seriesId) {
        // Maybe it's a movie subtitle
        const movie = await db.movie.findUnique({ where: { id: seriesId } });
        if (movie) {
          // Upload and set as movie subtitle
          const id = crypto.randomUUID();
          const path = `subtitles/${id}.${ext}`;
          const buf = Buffer.from(await file.arrayBuffer());
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
            contentType: "text/plain",
            cacheControl: "3600",
          });

          if (upErr) {
            results.push({ filename, matched: false, error: "Upload failed" });
            continue;
          }

          const { data } = supabase.storage.from(bucket).getPublicUrl(path);
          await db.movie.update({ where: { id: seriesId }, data: { subtitleUrl: data.publicUrl } });
          results.push({ filename, matched: true, episode: movie.title });
          continue;
        }
      }

      if (!dbEpisode) {
        results.push({ filename, matched: false, error: "No matching episode found" });
        continue;
      }

      // Upload the subtitle file to Supabase Storage
      const id = crypto.randomUUID();
      const path = `subtitles/${id}.${ext}`;
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
        contentType: "text/plain",
        cacheControl: "3600",
      });

      if (upErr) {
        results.push({ filename, matched: false, error: "Storage upload failed" });
        continue;
      }

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);

      // Save the subtitle URL on the episode
      await db.episode.update({
        where: { id: dbEpisode.id },
        data: { subtitleUrl: data.publicUrl },
      });

      results.push({
        filename,
        matched: true,
        episode: `S${season}E${episode}`,
      });
    }

    const matched = results.filter((r) => r.matched).length;
    const failed = results.filter((r) => !r.matched).length;

    return NextResponse.json({ matched, failed, results });
  } catch (e) {
    console.error("[subtitles bulk]", e);
    return NextResponse.json({ error: "Bulk upload failed." }, { status: 500 });
  }
}

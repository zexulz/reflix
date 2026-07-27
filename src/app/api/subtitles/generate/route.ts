import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabase, getBucket } from "@/lib/supabase";
import crypto from "node:crypto";
import ZAI from "z-ai-web-dev-sdk";

/*
  POST /api/subtitles/generate

  Generates a Ukrainian subtitle for the NEXT episode in a series that is
  missing one. One episode per request — the frontend loops until all are
  done (or until OpenSubtitles quota is hit). This avoids HTTP timeouts and
  gives real-time progress.

  Pipeline (server-side, all in one request):
    1. Find next episode (by season/episode order) with no subtitleUrl.
    2. Fetch English .srt from OpenSubtitles (3 search strategies).
    3. Translate to Ukrainian using the z-ai-web-dev-sdk LLM (no Google
       Translate key needed — the SDK is free and available in this env).
    4. Upload the Ukrainian .srt to Supabase Storage.
    5. Link the episode's subtitleUrl.

  Body: { seriesId: string, openSubsKey?: string }
  Returns: { done, episode, title, total, completed, remaining, quotaHit?, error? }
*/

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Extract translatable text lines from an .srt ──
function extractTexts(srt: string): string[] {
  const texts: string[] = [];
  for (const line of srt.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (/^\d+$/.test(t)) continue;                       // cue index
    if (/^\d{2}:\d{2}:\d{2}/.test(t)) continue;          // timestamp
    if (t.includes("-->")) continue;                     // arrow
    texts.push(t);
  }
  return texts;
}

// ── Rebuild the .srt with translated lines (same structure/timestamps) ──
function replaceTexts(srt: string, translations: string[]): string {
  let idx = 0;
  return srt
    .split("\n")
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (/^\d+$/.test(t)) return line;
      if (/^\d{2}:\d{2}:\d{2}/.test(t)) return line;
      if (t.includes("-->")) return line;
      return translations[idx++] ?? line;
    })
    .join("\n");
}

// ── Translate a batch of subtitle lines en → uk using the z-ai LLM ──
// We number each line so we can map translations back 1:1 even if the model
// returns them in a slightly different shape. We ask for "N|||translation".
async function translateBatchUk(texts: string[]): Promise<string[]> {
  if (texts.length === 0) return [];
  const zai = await ZAI.create();

  const out: string[] = [];
  // translate in chunks of 60 lines to keep prompts manageable
  const CHUNK = 60;
  for (let i = 0; i < texts.length; i += CHUNK) {
    const chunk = texts.slice(i, i + CHUNK);
    const numbered = chunk.map((t, n) => `${i + n + 1}|||${t}`).join("\n");

    let done = false;
    for (let attempt = 0; attempt < 3 && !done; attempt++) {
      try {
        const completion = await zai.chat.completions.create({
          messages: [
            {
              role: "assistant",
              content:
                "You are a professional subtitle translator for a streaming service. " +
                "Translate English subtitle lines into natural, fluent Ukrainian. " +
                "Keep each translation concise (it must fit on screen) and preserve the " +
                "meaning, tone, and emotional register. Do NOT merge, split, or reorder lines. " +
                "Return ONLY the translations, one per line, in the exact format " +
                "\"N|||український переклад\". No commentary, no markdown, no extra text.",
            },
            {
              role: "user",
              content: numbered,
            },
          ],
          thinking: { type: "disabled" },
        });

        const raw = completion.choices[0]?.message?.content || "";
        const map = new Map<number, string>();
        for (const ln of raw.split("\n")) {
          const m = ln.match(/^(\d+)\|\|\|(.*)$/);
          if (m) map.set(Number(m[1]), m[2].trim());
        }
        // fill outputs in order; fall back to original line if missing
        for (let n = 0; n < chunk.length; n++) {
          const lineNo = i + n + 1;
          out.push(map.get(lineNo) || chunk[n]);
        }
        done = true;
      } catch {
        await sleep(1500 * (attempt + 1));
      }
    }
    if (!done) {
      // fallback: keep English for this chunk so the episode still gets a file
      out.push(...chunk);
    }
    await sleep(300);
  }
  return out;
}

// ── Fetch English .srt from OpenSubtitles ──
async function fetchJson(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, { ...opts, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function downloadSub(
  fileId: number,
  headers: Record<string, string>
): Promise<string | null> {
  try {
    const dlData = await fetchJson(
      "https://api.opensubtitles.com/api/v1/download",
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ file_id: fileId }),
      }
    );
    // quota limit?
    if (dlData.message && /allowed|limit|quota/i.test(dlData.message)) {
      return null;
    }
    const link = dlData.link;
    if (!link) return null;
    const fileRes = await fetch(link, { redirect: "follow" });
    if (!fileRes.ok) return null;
    const buf = Buffer.from(await fileRes.arrayBuffer());
    // gunzip if needed
    if (buf[0] === 0x1f && buf[1] === 0x8b) {
      const zlib = await import("node:zlib");
      return zlib.gunzipSync(buf).toString("utf-8");
    }
    return buf.toString("utf-8");
  } catch {
    return null;
  }
}

async function fetchEnglishSrt(
  seriesName: string,
  tmdbId: number,
  season: number,
  episode: number,
  headers: Record<string, string>
): Promise<{ srt: string; quotaHit: boolean }> {
  const epCode = `S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
  const searches = [
    `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(seriesName + " " + epCode)}&languages=en`,
    `https://api.opensubtitles.com/api/v1/subtitles?tmdb_id=${tmdbId}&season=${season}&episode=${episode}&languages=en`,
    `https://api.opensubtitles.com/api/v1/subtitles?query=${encodeURIComponent(epCode + " " + seriesName)}&languages=en`,
  ];

  for (const url of searches) {
    try {
      const data = await fetchJson(url, { headers });
      const subs = data.data || [];
      if (subs.length === 0) continue;

      for (const sub of subs.slice(0, 5)) {
        const fileId = sub.attributes?.files?.[0]?.file_id;
        if (!fileId) continue;
        const srt = await downloadSub(fileId, headers);
        if (srt && srt.length > 50) return { srt, quotaHit: false };
      }
    } catch {
      // try next strategy
    }
    await sleep(300);
  }
  // detect quota by testing a known-good query
  try {
    const test = await fetchJson(
      "https://api.opensubtitles.com/api/v1/subtitles?query=The+Mentalist&languages=en",
      { headers }
    );
    const quotaHit = !test.data || test.data.length === 0;
    return { srt: "", quotaHit };
  } catch {
    return { srt: "", quotaHit: true };
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.seriesId !== "string")
      return NextResponse.json({ error: "Expected { seriesId }." }, { status: 400 });

    const openSubsKey =
      (typeof body.openSubsKey === "string" && body.openSubsKey.trim()) ||
      process.env.OPENSUBTITLES_API_KEY ||
      "";
    if (!openSubsKey)
      return NextResponse.json(
        { error: "OpenSubtitles API key required. Get a free key at opensubtitles.com." },
        { status: 400 }
      );

    const series = await db.movie.findUnique({ where: { id: body.seriesId } });
    if (!series || series.type !== "series" || !series.tmdbId)
      return NextResponse.json({ error: "Series not found." }, { status: 404 });

    // total + completed counts for progress
    const allEps = await db.episode.findMany({
      where: { seriesId: series.id },
      orderBy: [{ season: "asc" }, { episode: "asc" }],
    });
    const total = allEps.length;
    const completed = allEps.filter((e) => e.subtitleUrl).length;

    // find next episode missing a subtitle
    const next = allEps.find((e) => !e.subtitleUrl);
    if (!next) {
      return NextResponse.json({
        done: true,
        episode: null,
        total,
        completed,
        remaining: 0,
        message: "All episodes already have subtitles.",
      });
    }

    const headers: Record<string, string> = {
      "Api-Key": openSubsKey,
      "User-Agent": "ReflixSubs v1.0",
    };

    // 1. fetch English .srt
    const { srt, quotaHit } = await fetchEnglishSrt(
      series.title,
      series.tmdbId,
      next.season,
      next.episode,
      headers
    );

    if (quotaHit) {
      return NextResponse.json({
        done: false,
        episode: `S${next.season}E${next.episode}`,
        total,
        completed,
        remaining: total - completed,
        quotaHit: true,
        error: "OpenSubtitles daily quota reached. Try again tomorrow or with a new API key.",
      });
    }
    if (!srt) {
      return NextResponse.json({
        done: false,
        episode: `S${next.season}E${next.episode}`,
        total,
        completed,
        remaining: total - completed - 1,
        error: "No English subtitle found on OpenSubtitles for this episode.",
        skip: true,
      });
    }

    // 2. translate to Ukrainian via z-ai LLM
    const texts = extractTexts(srt);
    const translations = await translateBatchUk(texts);
    const ukSrt = replaceTexts(srt, translations);

    // 3. upload to Supabase Storage
    const supabase = getSupabase();
    const bucket = getBucket();
    const id = crypto.randomUUID();
    const path = `subtitles/${id}.srt`;
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, Buffer.from(ukSrt, "utf-8"), {
        contentType: "text/plain",
        cacheControl: "3600",
      });
    if (upErr) {
      return NextResponse.json({
        done: false,
        episode: `S${next.season}E${next.episode}`,
        total,
        completed,
        remaining: total - completed,
        error: "Storage upload failed.",
      });
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);

    // 4. link the episode
    await db.episode.update({
      where: { id: next.id },
      data: { subtitleUrl: pub.publicUrl },
    });

    const newCompleted = completed + 1;
    return NextResponse.json({
      done: true,
      episode: `S${next.season}E${next.episode}`,
      title: next.title,
      total,
      completed: newCompleted,
      remaining: total - newCompleted,
      cueCount: texts.length,
    });
  } catch (e) {
    console.error("[subtitles generate]", e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed." },
      { status: 500 }
    );
  }
}

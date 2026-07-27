import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabase, getBucket } from "@/lib/supabase";
import crypto from "node:crypto";

// POST /api/subtitles/episode — upload a subtitle file for an episode
// Body: { episodeId, file } (multipart form data)
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const form = await req.formData();
    const episodeId = String(form.get("episodeId") || "");
    const file = form.get("file");

    if (!episodeId) return NextResponse.json({ error: "episodeId is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    // accept .srt and .vtt files
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "srt" && ext !== "vtt") {
      return NextResponse.json({ error: "Only .srt or .vtt files are allowed." }, { status: 400 });
    }

    // upload to Supabase Storage
    const supabase = getSupabase();
    const bucket = getBucket();
    const id = crypto.randomUUID();
    const path = `subtitles/${id}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(bucket).upload(path, buf, {
      contentType: "text/plain",
      cacheControl: "3600",
      upsert: false,
    });

    if (upErr) {
      console.error("[subtitle upload]", upErr.message);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const subtitleUrl = data.publicUrl;

    // save to the episode
    await db.episode.update({
      where: { id: episodeId },
      data: { subtitleUrl },
    });

    return NextResponse.json({ subtitleUrl });
  } catch (e) {
    console.error("[subtitle episode]", e);
    return NextResponse.json({ error: "Could not upload subtitle." }, { status: 500 });
  }
}

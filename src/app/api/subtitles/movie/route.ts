import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabase, getBucket } from "@/lib/supabase";
import crypto from "node:crypto";

// POST /api/subtitles/movie — upload a subtitle file for a movie
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const form = await req.formData();
    const movieId = String(form.get("movieId") || "");
    const file = form.get("file");

    if (!movieId) return NextResponse.json({ error: "movieId is required." }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided." }, { status: 400 });

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "srt" && ext !== "vtt") {
      return NextResponse.json({ error: "Only .srt or .vtt files are allowed." }, { status: 400 });
    }

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

    await db.movie.update({
      where: { id: movieId },
      data: { subtitleUrl },
    });

    return NextResponse.json({ subtitleUrl });
  } catch (e) {
    console.error("[subtitle movie]", e);
    return NextResponse.json({ error: "Could not upload subtitle." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSupabase, getBucket } from "@/lib/supabase";
import crypto from "node:crypto";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, WebP, or GIF images are allowed." },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 8 MB." }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const id = crypto.randomUUID();
    const path = `uploads/${id}.${ext}`;

    // upload to Supabase Storage — works on Vercel (no local filesystem needed)
    const supabase = getSupabase();
    const bucket = getBucket();
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(path, buf, {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });

    if (upErr) {
      console.error("[upload] supabase:", upErr.message);
      return NextResponse.json({ error: "Upload failed." }, { status: 500 });
    }

    // get the public URL so the browser can load the image
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);

    return NextResponse.json({ url: data.publicUrl });
  } catch (e) {
    console.error("[upload]", e);
    return NextResponse.json({ error: "Could not upload file." }, { status: 500 });
  }
}

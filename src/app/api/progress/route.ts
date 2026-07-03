import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET — all progress for the signed-in user
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ progress: [] });

  const rows = await db.watchProgress.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ progress: rows });
}

// POST — upsert progress for a single movie
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const movieId = String(body.movieId ?? "");
    const position = Math.max(0, Number(body.position) || 0);
    const duration = Math.max(0, Number(body.duration) || 0);

    if (!movieId)
      return NextResponse.json({ error: "movieId is required." }, { status: 400 });

    const movie = await db.movie.findUnique({ where: { id: movieId } });
    if (!movie) return NextResponse.json({ error: "Movie not found." }, { status: 404 });

    // If we've reached the end (within 15s), clear progress instead.
    const finished = duration > 0 && position >= duration - 15;
    if (finished) {
      await db.watchProgress.deleteMany({
        where: { userId: user.id, movieId },
      });
      return NextResponse.json({ progress: null, finished: true });
    }

    const row = await db.watchProgress.upsert({
      where: { userId_movieId: { userId: user.id, movieId } },
      update: { position, duration },
      create: { userId: user.id, movieId, position, duration },
    });

    return NextResponse.json({ progress: row });
  } catch (e) {
    console.error("[progress POST]", e);
    return NextResponse.json({ error: "Could not save progress." }, { status: 500 });
  }
}

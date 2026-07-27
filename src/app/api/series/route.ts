import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/series — all series (type="series") for the Series reel
export async function GET() {
  const series = await db.movie.findMany({
    where: { type: "series" },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      posterUrl: true,
      backdropUrl: true,
      videoUrl: true,
      subtitleUrl: true,
      tmdbId: true,
      type: true,
      duration: true,
      year: true,
      genre: true,
      director: true,
      rating: true,
      featured: true,
      isNew: true,
      isOriginal: true,
      isEditorsPick: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ movies: series });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/series/[id]/episodes — all episodes for a series, grouped by season
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episodes = await db.episode.findMany({
    where: { seriesId: id },
    orderBy: [{ season: "asc" }, { episode: "asc" }],
  });

  // group by season
  const seasons: Record<number, typeof episodes> = {};
  for (const ep of episodes) {
    if (!seasons[ep.season]) seasons[ep.season] = [];
    seasons[ep.season].push(ep);
  }

  return NextResponse.json({ episodes, seasons });
}

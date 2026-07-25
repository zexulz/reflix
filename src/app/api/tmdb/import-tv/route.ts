import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/original";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    if (!TMDB_KEY)
      return NextResponse.json({ error: "TMDB_API_KEY not configured." }, { status: 500 });

    const body = await req.json().catch(() => null);
    if (!body?.tmdbId)
      return NextResponse.json({ error: "tmdbId is required." }, { status: 400 });

    // fetch full TV details from TMDB
    const detailUrl = `${TMDB_BASE}/tv/${body.tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`;
    const res = await fetch(detailUrl);
    if (!res.ok)
      return NextResponse.json({ error: "TMDB TV show not found." }, { status: 404 });
    const d = await res.json();

    const name: string = d.name || "Untitled";
    const year: number = d.first_air_date ? Number(d.first_air_date.slice(0, 4)) : 0;
    const runtime: number = d.episode_run_time?.[0] || 0;
    const rating: number = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
    const genre: string = d.genres?.[0]?.name || "Drama";
    const logline: string = d.overview || "";

    // creator (TV equivalent of director)
    const director: string = d.created_by?.[0]?.name || "";
    // top-billed cast
    const cast: string = (d.credits?.cast || [])
      .slice(0, 5)
      .map((c: any) => c.name)
      .join(", ");

    const posterUrl: string = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
    const backdropUrl: string | null = d.backdrop_path
      ? `${IMG_BASE}${d.backdrop_path}`
      : null;

    // avoid duplicates
    const existing = await db.movie.findFirst({ where: { tmdbId: d.id } });
    if (existing) {
      return NextResponse.json({ movie: existing, alreadyExists: true });
    }

    const slug = `${slugify(name)}-${Date.now().toString(36)}`;

    const movie = await db.movie.create({
      data: {
        title: name,
        slug,
        logline,
        description: logline,
        posterUrl,
        backdropUrl,
        videoUrl: null,
        tmdbId: d.id,
        type: "series",
        imdbRank: null,
        duration: runtime,
        year,
        genre,
        director,
        cast,
        rating,
        featured: false,
        isNew: year >= new Date().getFullYear() - 1,
        isOriginal: false,
        isEditorsPick: false,
      },
    });

    return NextResponse.json({ movie, alreadyExists: false });
  } catch (e) {
    console.error("[tmdb import-tv]", e);
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}

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

    // fetch full movie details from TMDB (credits + release info for director + runtime)
    const detailUrl = `${TMDB_BASE}/movie/${body.tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,release_dates`;
    const res = await fetch(detailUrl);
    if (!res.ok)
      return NextResponse.json({ error: "TMDB movie not found." }, { status: 404 });
    const d = await res.json();

    const title: string = d.title || "Untitled";
    const year: number = d.release_date ? Number(d.release_date.slice(0, 4)) : 0;
    const runtime: number = d.runtime || 0;
    const rating: number = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
    const genre: string = d.genres?.[0]?.name || "Drama";
    const logline: string = d.overview || "";

    // director from credits
    const director: string =
      d.credits?.crew?.find((c: any) => c.job === "Director")?.name || "";
    // top-billed cast
    const cast: string = (d.credits?.cast || [])
      .slice(0, 5)
      .map((c: any) => c.name)
      .join(", ");

    // images — use TMDB CDN URLs directly (reliable, no storage needed)
    const posterUrl: string = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
    const backdropUrl: string | null = d.backdrop_path
      ? `${IMG_BASE}${d.backdrop_path}`
      : null;

    // IMDb ID (if TMDB has it)
    const imdbId: string | null = d.imdb_id || null;
    // TMDB ID (the numeric ID from the URL)
    const tmdbId: number | null = d.id || null;

    // avoid duplicates: if a movie with this imdbId or same title+year exists, return it
    const existing = imdbId
      ? await db.movie.findFirst({ where: { imdbId } })
      : await db.movie.findFirst({ where: { title, year } });
    if (existing) {
      return NextResponse.json({ movie: existing, alreadyExists: true });
    }

    // determine the next imdbRank (null for admin-added, so they don't
    // interfere with the Top 250 ordering)
    const slug = `${slugify(title)}-${Date.now().toString(36)}`;

    const movie = await db.movie.create({
      data: {
        title,
        slug,
        logline,
        description: logline,
        posterUrl,
        backdropUrl,
        videoUrl: null, // empty slot — admin pastes licensed stream URL via edit form
        imdbId,
        tmdbId,
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
    console.error("[tmdb import]", e);
    return NextResponse.json({ error: "Import failed." }, { status: 500 });
  }
}

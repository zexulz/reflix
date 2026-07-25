import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

/*
  Bulk-import video URLs by TMDB ID.

  The curator pastes a list of URLs. This route extracts the TMDB ID (a
  trailing number) from each URL, matches it to a Movie record, and stores
  the URL directly in the videoUrl field. The URL content is never logged or
  inspected — it goes straight from the request body into the database.

  If a TMDB ID isn't in the catalog yet, the route fetches the movie's
  details from TMDB and creates a new Movie record automatically — so you
  can paste URLs for films that aren't in your catalog yet.

  Accepted line formats:
    1. Bare URL with TMDB ID at the end (no extension — most common):
       https://your-host.com/278
       https://your-host.com/films/155
    2. Bare URL with TMDB ID anywhere in it:
       https://your-host.com/movie/278/stream
    3. Explicit "tmdbId url" separated by a delimiter:
       278 | https://example.com/film

  Lines starting with # are ignored.
*/

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

// fetch full movie details from TMDB and create (or update) a Movie record.
// uses upsert on tmdbId so duplicates are impossible even under concurrent requests.
async function createMovieFromTmdb(tmdbId: number, videoUrl: string) {
  if (!TMDB_KEY) return null;
  const res = await fetch(
    `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`
  );
  if (!res.ok) return null;
  const d = await res.json();

  const title: string = d.title || "Untitled";
  const year: number = d.release_date ? Number(d.release_date.slice(0, 4)) : 0;
  const runtime: number = d.runtime || 0;
  const rating: number = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
  const genre: string = d.genres?.[0]?.name || "Drama";
  const logline: string = d.overview || "";
  const director: string =
    d.credits?.crew?.find((c: any) => c.job === "Director")?.name || "";
  const cast: string = (d.credits?.cast || [])
    .slice(0, 5)
    .map((c: any) => c.name)
    .join(", ");
  const posterUrl: string = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
  const backdropUrl: string | null = d.backdrop_path
    ? `${IMG_BASE}${d.backdrop_path}`
    : null;
  const imdbId: string | null = d.imdb_id || null;

  // upsert on tmdbId — if a movie with this tmdbId already exists (created
  // by a concurrent request or an earlier import), update its videoUrl
  // instead of creating a duplicate. The @unique constraint on tmdbId
  // enforces this at the database level too.
  const movie = await db.movie.upsert({
    where: { tmdbId },
    update: { videoUrl },
    create: {
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      logline,
      description: logline,
      posterUrl,
      backdropUrl,
      videoUrl,
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
  return movie;
}

// fetch TV show details from TMDB and create a Movie record with type="series".
// Called as a fallback when a TMDB ID doesn't match a movie.
async function createSeriesFromTmdb(tmdbId: number, videoUrl: string) {
  if (!TMDB_KEY) return null;
  const res = await fetch(
    `${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`
  );
  if (!res.ok) return null;
  const d = await res.json();

  const title: string = d.name || "Untitled";
  const year: number = d.first_air_date ? Number(d.first_air_date.slice(0, 4)) : 0;
  const runtime: number = d.episode_run_time?.[0] || 0;
  const rating: number = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
  const genre: string = d.genres?.[0]?.name || "Drama";
  const logline: string = d.overview || "";
  const director: string = d.created_by?.[0]?.name || "";
  const cast: string = (d.credits?.cast || [])
    .slice(0, 5)
    .map((c: any) => c.name)
    .join(", ");
  const posterUrl: string = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
  const backdropUrl: string | null = d.backdrop_path
    ? `${IMG_BASE}${d.backdrop_path}`
    : null;

  const movie = await db.movie.upsert({
    where: { tmdbId },
    update: { videoUrl },
    create: {
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      logline,
      description: logline,
      posterUrl,
      backdropUrl,
      videoUrl,
      tmdbId,
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
  return movie;
}

type Result = {
  matched: { tmdbId: number; title: string }[];
  created: { tmdbId: number; title: string }[];
  notFound: number[];
  malformed: number;
};

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body.text !== "string")
      return NextResponse.json({ error: "Expected { text: string }." }, { status: 400 });

    const lines = body.text.split("\n");
    const result: Result = { matched: [], created: [], notFound: [], malformed: 0 };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      let tmdbId: number | null = null;
      let url: string = line;

      // try explicit "tmdbId <delimiter> url" first
      const explicit = line.match(/^(\d{1,8})\s*[|,:]\s*(.+)$/);
      if (explicit) {
        tmdbId = Number(explicit[1]);
        url = explicit[2].trim();
      } else {
        // extract the trailing number from the URL (the TMDB ID)
        const trailingMatch = line.match(/\/(\d{1,8})(?:\/?|\?|#|$)/);
        if (trailingMatch) {
          tmdbId = Number(trailingMatch[1]);
          url = line;
        } else {
          // fallback: any number in the line
          const anyNum = line.match(/\d{2,8}/);
          if (anyNum) {
            tmdbId = Number(anyNum[0]);
            url = line;
          }
        }
      }

      if (tmdbId == null || tmdbId < 1) {
        result.malformed++;
        continue;
      }

      // try to find an existing movie by tmdbId
      const existing = await db.movie.findFirst({ where: { tmdbId } });
      if (existing) {
        // update the existing movie's videoUrl — no duplicate created
        await db.movie.update({
          where: { id: existing.id },
          data: { videoUrl: url },
        });
        result.matched.push({ tmdbId, title: existing.title });
      } else {
        // not in catalog — try movie first, then TV show as fallback.
        // This auto-detects whether the TMDB ID is a movie or a series.
        const created = await createMovieFromTmdb(tmdbId, url);
        if (created) {
          result.created.push({ tmdbId, title: created.title });
        } else {
          // movie lookup failed — try TV show
          const tvCreated = await createSeriesFromTmdb(tmdbId, url);
          if (tvCreated) {
            result.created.push({ tmdbId, title: tvCreated.title });
          } else {
            // both movie and TV lookup failed
            result.notFound.push(tmdbId);
          }
        }
      }
    }

    return NextResponse.json({
      matched: result.matched.length,
      created: result.created.length,
      notFound: result.notFound,
      malformed: result.malformed,
      updatedTitles: result.matched.map((m) => m.title),
      createdTitles: result.created.map((m) => m.title),
    });
  } catch (e) {
    console.error("[bulk-import]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "Bulk import failed." }, { status: 500 });
  }
}

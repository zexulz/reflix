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

// ── Create a movie record from TMDB ──
async function createMovieFromTmdb(tmdbId: number, videoUrl: string) {
  if (!TMDB_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits`);
  if (!res.ok) return null;
  const d = await res.json();

  const title = d.title || "Untitled";
  const year = d.release_date ? Number(d.release_date.slice(0, 4)) : 0;
  const rating = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
  const genre = d.genres?.[0]?.name || "Drama";
  const logline = d.overview || "";
  const director = d.credits?.crew?.find((c: any) => c.job === "Director")?.name || "";
  const cast = (d.credits?.cast || []).slice(0, 5).map((c: any) => c.name).join(", ");
  const posterUrl = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
  const backdropUrl = d.backdrop_path ? `${IMG_BASE}${d.backdrop_path}` : null;
  const imdbId = d.imdb_id || null;

  return db.movie.upsert({
    where: { tmdbId },
    update: { videoUrl },
    create: {
      title, slug: `${slugify(title)}-${Date.now().toString(36)}`,
      logline, description: logline, posterUrl, backdropUrl, videoUrl,
      imdbId, tmdbId, type: "movie", imdbRank: null,
      duration: d.runtime || 0, year, genre, director, cast, rating,
      featured: false, isNew: year >= new Date().getFullYear() - 1,
      isOriginal: false, isEditorsPick: false,
    },
  });
}

// ── Create or find a series record from TMDB TV ──
async function getOrCreateSeries(tmdbId: number) {
  // check if series already exists
  const existing = await db.movie.findFirst({ where: { tmdbId, type: "series" } });
  if (existing) return existing;

  if (!TMDB_KEY) return null;
  const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_KEY}`);
  if (!res.ok) return null;
  const d = await res.json();

  const name = d.name || "Untitled";
  const year = d.first_air_date ? Number(d.first_air_date.slice(0, 4)) : 0;
  const rating = d.vote_average ? Math.round(d.vote_average * 10) / 10 : 0;
  const genre = d.genres?.[0]?.name || "Drama";
  const logline = d.overview || "";
  const director = d.created_by?.[0]?.name || "";
  const posterUrl = d.poster_path ? `${IMG_BASE}${d.poster_path}` : "";
  const backdropUrl = d.backdrop_path ? `${IMG_BASE}${d.backdrop_path}` : null;

  return db.movie.upsert({
    where: { tmdbId },
    update: { type: "series" },
    create: {
      title: name, slug: `${slugify(name)}-${Date.now().toString(36)}`,
      logline, description: logline, posterUrl, backdropUrl,
      videoUrl: null, tmdbId, type: "series", imdbRank: null,
      duration: d.episode_run_time?.[0] || 0, year, genre, director,
      cast: "", rating, featured: false, isNew: year >= new Date().getFullYear() - 1,
      isOriginal: false, isEditorsPick: false,
    },
  });
}

// ── Fetch episode title from TMDB ──
async function getEpisodeTitle(tmdbId: number, season: number, episode: number): Promise<string> {
  if (!TMDB_KEY) return "";
  try {
    const res = await fetch(`${TMDB_BASE}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_KEY}`);
    if (!res.ok) return "";
    const d = await res.json();
    return d.name || `S${season}E${episode}`;
  } catch {
    return "";
  }
}

// ── Upsert an episode ──
async function upsertEpisode(seriesId: string, season: number, episode: number, videoUrl: string, title: string) {
  return db.episode.upsert({
    where: { seriesId_season_episode: { seriesId, season, episode } },
    update: { videoUrl },
    create: { seriesId, season, episode, videoUrl, title },
  });
}

type Result = {
  matched: { tmdbId: number; title: string }[];
  created: { tmdbId: number; title: string }[];
  episodesAdded: { series: string; season: number; episode: number }[];
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
    const result: Result = { matched: [], created: [], episodesAdded: [], notFound: [], malformed: 0 };

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      // ── Detect URL type ──
      // TV URL format:  host.com/tv/{tmdbId}/{season}/{episode}
      // Movie URL format: host.com/{tmdbId}  or  host.com/movie/{tmdbId}
      const tvMatch = line.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/);
      const movieMatch = line.match(/\/(\d{1,8})(?:\/?|\?|#|$)/);

      if (tvMatch) {
        // ── TV episode URL ──
        const tmdbId = Number(tvMatch[1]);
        const season = Number(tvMatch[2]);
        const episode = Number(tvMatch[3]);
        const url = line;

        // get or create the series
        const series = await getOrCreateSeries(tmdbId);
        if (!series) {
          result.notFound.push(tmdbId);
          continue;
        }

        // fetch episode title from TMDB
        const epTitle = await getEpisodeTitle(tmdbId, season, episode);

        // upsert the episode
        await upsertEpisode(series.id, season, episode, url, epTitle || `S${season}E${episode}`);
        result.episodesAdded.push({ series: series.title, season, episode });

      } else if (movieMatch) {
        // ── Movie URL ──
        const tmdbId = Number(movieMatch[1]);
        const url = line;

        // check if it already exists
        const existing = await db.movie.findFirst({ where: { tmdbId } });
        if (existing) {
          await db.movie.update({ where: { id: existing.id }, data: { videoUrl: url } });
          result.matched.push({ tmdbId, title: existing.title });
        } else {
          // try movie first, then TV (for series without episode info)
          const created = await createMovieFromTmdb(tmdbId, url);
          if (created) {
            result.created.push({ tmdbId, title: created.title });
          } else {
            result.notFound.push(tmdbId);
          }
        }
      } else {
        result.malformed++;
      }
    }

    return NextResponse.json({
      matched: result.matched.length,
      created: result.created.length,
      episodesAdded: result.episodesAdded.length,
      notFound: result.notFound,
      malformed: result.malformed,
      updatedTitles: result.matched.map((m) => m.title),
      createdTitles: result.created.map((m) => m.title),
      episodeDetails: result.episodesAdded,
    });
  } catch (e) {
    console.error("[bulk-import]", e instanceof Error ? e.message : "error");
    return NextResponse.json({ error: "Bulk import failed." }, { status: 500 });
  }
}

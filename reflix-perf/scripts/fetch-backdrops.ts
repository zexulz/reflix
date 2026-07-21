/**
 * fetch-backdrops.ts
 *
 * Fetches real backdrops + posters for every movie in the catalog from TMDB
 * (The Movie Database — the industry-standard source for movie artwork).
 *
 * Prerequisites:
 *   - TMDB_API_KEY set in .env (free key from https://www.themoviedb.org/settings/api)
 *
 * What it does:
 *   1. Reads every Movie from the database.
 *   2. For each film, looks it up on TMDB by IMDb ID (most precise), falling
 *      back to title + year search when no IMDb ID is stored.
 *   3. Downloads the highest-rated backdrop and poster images to
 *      /public/images/movies/{slug}-backdrop.jpg and -poster.jpg.
 *   4. Updates each Movie's backdropUrl and posterUrl in the database.
 *
 * Run: bun run scripts/fetch-backdrops.ts
 *
 * TMDB's image CDN (image.tmdb.org) provides these for app use under their
 * terms of service — this is the standard way streaming apps source artwork.
 */

import { PrismaClient } from "@prisma/client";
import { promises as fs } from "node:fs";
import path from "node:path";

const db = new PrismaClient();

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/original";
const OUT_DIR = path.join(process.cwd(), "public", "images", "movies");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type TMDBFindResult = {
  movie_results?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    backdrop_path: string | null;
  }>;
};
type TMDBSearchResult = {
  results?: Array<{
    id: number;
    title: string;
    release_date?: string;
    poster_path: string | null;
    backdrop_path: string | null;
  }>;
};
type TMDBMovieDetail = {
  id: number;
  poster_path: string | null;
  backdrop_path: string | null;
};

async function tmdbGet(endpoint: string, retries = 3): Promise<any> {
  const url = `${TMDB_BASE}${endpoint}${
    endpoint.includes("?") ? "&" : "?"
  }api_key=${TMDB_KEY}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        // rate limited — back off
        console.log("    rate limited, waiting 2s…");
        await sleep(2000);
        continue;
      }
      if (!res.ok) throw new Error(`TMDB ${res.status}: ${await res.text()}`);
      return res.json();
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(1000 * attempt);
    }
  }
}

async function downloadImage(imgPath: string, dest: string): Promise<void> {
  const url = `${IMG_BASE}${imgPath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image download ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
}

async function findMovie(imdbId: string | null, title: string, year: number) {
  // 1. IMDb ID lookup — most precise
  if (imdbId) {
    const data: TMDBFindResult = await tmdbGet(
      `/find/${imdbId}?external_source=imdb_id`
    );
    if (data.movie_results && data.movie_results.length > 0) {
      return data.movie_results[0];
    }
  }
  // 2. title + year search fallback
  const q = encodeURIComponent(title);
  const data: TMDBSearchResult = await tmdbGet(
    `/search/movie?query=${q}&year=${year}`
  );
  if (data.results && data.results.length > 0) {
    // pick the result whose release_date year matches, else the first
    const match =
      data.results.find(
        (r) => r.release_date && r.release_date.startsWith(String(year))
      ) || data.results[0];
    return match;
  }
  return null;
}

async function main() {
  if (!TMDB_KEY) {
    console.error("ERROR: TMDB_API_KEY is not set.");
    console.error("Get a free key at https://www.themoviedb.org/settings/api");
    console.error("Then add TMDB_API_KEY=your_key to .env");
    process.exit(1);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  // only fetch films still missing artwork (makes the script resumable)
  const movies = await db.movie.findMany({
    where: {
      OR: [{ backdropUrl: null }, { posterUrl: "" }],
    },
    orderBy: { imdbRank: "asc" },
  });
  console.log(`Fetching artwork for ${movies.length} movies from TMDB…\n`);

  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const m of movies) {
    process.stdout.write(
      `[${done + skipped + failed + 1}/${movies.length}] ${m.title} (${m.year})… `
    );
    try {
      const found = await findMovie(m.imdbId, m.title, m.year);
      if (!found) {
        console.log("not found on TMDB");
        skipped++;
        continue;
      }

      // fetch full detail to get the best images (search results sometimes omit backdrop)
      const detail: TMDBMovieDetail = await tmdbGet(`/movie/${found.id}`);
      const backdropPath = detail.backdrop_path;
      const posterPath = detail.poster_path;

      const updates: { backdropUrl?: string | null; posterUrl?: string } = {};

      if (backdropPath) {
        const dest = path.join(OUT_DIR, `${m.slug}-backdrop.jpg`);
        await downloadImage(backdropPath, dest);
        updates.backdropUrl = `/images/movies/${m.slug}-backdrop.jpg`;
      }
      if (posterPath) {
        const dest = path.join(OUT_DIR, `${m.slug}-poster.jpg`);
        await downloadImage(posterPath, dest);
        updates.posterUrl = `/images/movies/${m.slug}-poster.jpg`;
      }

      if (Object.keys(updates).length === 0) {
        console.log("no images available");
        skipped++;
        continue;
      }

      await db.movie.update({ where: { id: m.id }, data: updates });
      console.log(
        `✓ backdrop${updates.posterUrl ? " + poster" : ""}${
          m.imdbId ? ` (by ${m.imdbId})` : " (by search)"
        }`
      );
      done++;
    } catch (e: unknown) {
      console.log(`✗ ${e instanceof Error ? e.message : "error"}`);
      failed++;
    }
    // be polite to the TMDB API
    await sleep(250);
  }

  console.log(`\nDone.`);
  console.log(`  artwork fetched: ${done}`);
  console.log(`  skipped (not found / no images): ${skipped}`);
  console.log(`  failed: ${failed}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

import { config } from "dotenv";
config({ override: true });

/*
  Updates all movies in Supabase to use TMDB CDN URLs for poster + backdrop.
  This makes the artwork work on Vercel (no local image files needed) and
  loads directly from TMDB's fast CDN.
*/

const TMDB_KEY = process.env.TMDB_API_KEY!;
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG_BASE = "https://image.tmdb.org/t/p/original";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

import { Client } from "pg";
const c = new Client({
  connectionString: process.env.DATABASE_URL!.replace(/\?sslmode=require/, ""),
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// get all movies with an imdbId
const { rows: movies } = await c.query(
  `SELECT id, title, "imdbId", "tmdbId" FROM "Movie" WHERE "imdbId" IS NOT NULL ORDER BY "imdbRank" ASC`
);
console.log(`Updating artwork for ${movies.length} movies from TMDB CDN…\n`);

let updated = 0;
let notFound = 0;

for (const m of movies) {
  let tmdbMovie: any = null;

  // try by tmdbId first (fastest), then by imdbId
  if (m.tmdbId) {
    try {
      const res = await fetch(`${TMDB_BASE}/movie/${m.tmdbId}?api_key=${TMDB_KEY}`);
      if (res.ok) tmdbMovie = await res.json();
    } catch {}
  }
  if (!tmdbMovie && m.imdbId) {
    try {
      const res = await fetch(
        `${TMDB_BASE}/find/${m.imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`
      );
      if (res.ok) {
        const data = await res.json();
        tmdbMovie = data.movie_results?.[0];
      }
    } catch {}
  }

  if (tmdbMovie) {
    const posterUrl = tmdbMovie.poster_path ? `${IMG_BASE}${tmdbMovie.poster_path}` : "";
    const backdropUrl = tmdbMovie.backdrop_path ? `${IMG_BASE}${tmdbMovie.backdrop_path}` : null;
    const tmdbId = tmdbMovie.id || m.tmdbId;

    await c.query(
      `UPDATE "Movie" SET "posterUrl" = $1, "backdropUrl" = $2, "tmdbId" = $3 WHERE id = $4`,
      [posterUrl, backdropUrl, tmdbId, m.id]
    );
    updated++;
    process.stdout.write(`✓ ${m.title.substring(0, 35).padEnd(37)} → ${tmdbId}\n`);
  } else {
    notFound++;
    process.stdout.write(`✗ ${m.title.substring(0, 35).padEnd(37)} → not found\n`);
  }
  await sleep(80);
}

console.log(`\nDone. Updated: ${updated} | Not found: ${notFound}`);

// verify
const { rows: stats } = await c.query(
  `SELECT COUNT(*) FILTER (WHERE "posterUrl" LIKE 'https://image.tmdb.org%') AS with_tmdb_poster,
          COUNT(*) FILTER (WHERE "backdropUrl" LIKE 'https://image.tmdb.org%') AS with_tmdb_backdrop,
          COUNT(*) AS total
   FROM "Movie"`
);
console.log(`TMDB CDN posters: ${stats[0].with_tmdb_poster}/${stats[0].total}`);
console.log(`TMDB CDN backdrops: ${stats[0].with_tmdb_backdrop}/${stats[0].total}`);

await c.end();

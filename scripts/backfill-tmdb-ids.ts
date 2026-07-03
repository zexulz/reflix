import { config } from "dotenv";
config({ override: true });
import { Client } from "pg";

const TMDB_KEY = process.env.TMDB_API_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rawUrl = process.env.DATABASE_URL!.replace(/\?sslmode=require/, "");
const c = new Client({
  connectionString: rawUrl,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// get all movies with an imdbId but no tmdbId
const { rows: movies } = await c.query(
  `SELECT id, title, year, "imdbId" FROM "Movie" WHERE "imdbId" IS NOT NULL AND "tmdbId" IS NULL ORDER BY "imdbRank" ASC`
);
console.log(`Backfilling TMDB IDs for ${movies.length} movies…`);

let done = 0;
let notFound = 0;

for (const m of movies) {
  let tmdbId: number | null = null;

  // 1. try IMDb ID lookup (most precise)
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/find/${m.imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`
    );
    if (res.ok) {
      const data: any = await res.json();
      tmdbId = data.movie_results?.[0]?.id ?? null;
    }
  } catch {}

  // 2. fallback: title + year search
  if (!tmdbId) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(m.title)}&year=${m.year}`
      );
      if (res.ok) {
        const data: any = await res.json();
        const match =
          data.results?.find(
            (r: any) => r.release_date?.startsWith(String(m.year))
          ) || data.results?.[0];
        tmdbId = match?.id ?? null;
      }
    } catch {}
  }

  if (tmdbId) {
    await c.query(`UPDATE "Movie" SET "tmdbId" = $1 WHERE id = $2`, [tmdbId, m.id]);
    done++;
  } else {
    notFound++;
  }

  process.stdout.write(
    `${done + notFound}/${movies.length} ${m.title.substring(0, 30).padEnd(32)} → ${tmdbId || "NOT FOUND"}\n`
  );
  await sleep(120);
}

console.log(`\nDone. Backfilled: ${done} | not found: ${notFound}`);

// verify
const { rows: stats } = await c.query(
  `SELECT COUNT(*) FILTER (WHERE "tmdbId" IS NOT NULL) AS with_tmdb, COUNT(*) AS total FROM "Movie"`
);
console.log(`Database now has ${stats[0].with_tmdb}/${stats[0].total} movies with TMDB IDs`);

await c.end();

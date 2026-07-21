import { config } from "dotenv";
config({ override: true });
import { Client } from "pg";

// strip sslmode from the URL so pg doesn't enforce verify-full;
// we set SSL permissively via the ssl option instead
const rawUrl = process.env.DATABASE_URL!.replace(/\?sslmode=require/, "");
const c = new Client({
  connectionString: rawUrl,
  ssl: { rejectUnauthorized: false },
});

await c.connect();
await c.query(`ALTER TABLE "Movie" ADD COLUMN IF NOT EXISTS "tmdbId" INTEGER`);
await c.query(`CREATE INDEX IF NOT EXISTS "Movie_tmdbId_idx" ON "Movie"("tmdbId")`);
const r = await c.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
  ["Movie", "tmdbId"]
);
console.log("tmdbId column exists:", r.rows.length > 0);
await c.end();

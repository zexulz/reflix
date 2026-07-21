import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { IMDB_TOP_250 } from "../src/lib/imdb-top250";

const db = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  console.log("Seeding Reflix — IMDb Top 250 catalog…");

  // Users (idempotent)
  const adminPassword = hashPassword("reflix-admin");
  const viewerPassword = hashPassword("reflix-viewer");

  const admin = await db.user.upsert({
    where: { email: "admin@reflix.com" },
    update: { passwordHash: adminPassword, role: "ADMIN", name: "Reflix Curator" },
    create: {
      email: "admin@reflix.com",
      name: "Reflix Curator",
      passwordHash: adminPassword,
      role: "ADMIN",
    },
  });

  const viewer = await db.user.upsert({
    where: { email: "viewer@reflix.com" },
    update: { passwordHash: viewerPassword },
    create: {
      email: "viewer@reflix.com",
      name: "Demo Viewer",
      passwordHash: viewerPassword,
      role: "USER",
    },
  });

  console.log(`  admin:  ${admin.email} (pass: reflix-admin)`);
  console.log(`  viewer: ${viewer.email} (pass: reflix-viewer)`);

  // Clear the old fake-movie catalog and any watch progress tied to it
  console.log("  clearing old catalog…");
  await db.watchProgress.deleteMany();
  await db.movie.deleteMany();

  // Seed the IMDb Top 250. videoUrl is intentionally left null — the
  // curator attaches their licensed hosted stream via the admin dashboard.
  // posterUrl is also left empty; the UI renders a typographic title card
  // until the curator pastes a real artwork URL.
  for (const entry of IMDB_TOP_250) {
    const featured = entry.rank <= 6;
    const isNew = entry.year >= 2019;
    const isEditorsPick = entry.rank <= 15;
    await db.movie.create({
      data: {
        title: entry.title,
        slug: `${slugify(entry.title)}-${entry.rank}`,
        logline: entry.logline,
        description: entry.logline,
        posterUrl: "",
        backdropUrl: null,
        videoUrl: null,
        imdbId: entry.imdbId || null,
        duration: entry.runtime,
        year: entry.year,
        genre: entry.genre,
        director: entry.director,
        cast: "",
        rating: entry.rating,
        featured,
        isNew,
        isOriginal: false,
        isEditorsPick,
        imdbRank: entry.rank,
      },
    });
  }

  const count = await db.movie.count();
  console.log(`  movies seeded: ${count}`);

  // relink artwork from /public/images/movies/ if the files exist on disk,
  // otherwise fetch artwork URLs from TMDB (so production deployments on
  // Vercel get artwork without needing 500 image files committed to the repo)
  try {
    const { readdirSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const imgDir = join(process.cwd(), "public", "images", "movies");

    if (existsSync(imgDir)) {
      // local dev: relink existing image files by slug
      const files = readdirSync(imgDir);
      const bySlug = new Map<string, { backdrop?: string; poster?: string }>();
      for (const f of files) {
        const m = f.match(/^(.+)-(backdrop|poster)\.jpg$/);
        if (m) {
          const slug = m[1];
          const kind = m[2] as "backdrop" | "poster";
          if (!bySlug.has(slug)) bySlug.set(slug, {});
          bySlug.get(slug)![kind] = `/images/movies/${f}`;
        }
      }
      let relinked = 0;
      const all = await db.movie.findMany({ select: { id: true, slug: true } });
      for (const m of all) {
        const art = bySlug.get(m.slug);
        if (art) {
          await db.movie.update({
            where: { id: m.id },
            data: {
              backdropUrl: art.backdrop || null,
              posterUrl: art.poster || "",
            },
          });
          relinked++;
        }
      }
      console.log(`  artwork relinked from local files: ${relinked}`);
    } else if (process.env.TMDB_API_KEY) {
      // production (Vercel): no local image files, so fetch TMDB CDN URLs
      // and store them directly in the database
      console.log("  no local images found — fetching artwork URLs from TMDB…");
      const TMDB_KEY = process.env.TMDB_API_KEY;
      const IMG_BASE = "https://image.tmdb.org/t/p/original";
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const moviesNeedingArt = await db.movie.findMany({
        where: {
          OR: [{ backdropUrl: null }, { posterUrl: "" }],
          imdbId: { not: null },
        },
        select: { id: true, imdbId: true },
      });
      let fetched = 0;
      for (const m of moviesNeedingArt) {
        try {
          const res = await fetch(
            `https://api.themoviedb.org/3/find/${m.imdbId}?api_key=${TMDB_KEY}&external_source=imdb_id`
          );
          if (res.ok) {
            const data: any = await res.json();
            const tmdbMovie = data.movie_results?.[0];
            if (tmdbMovie) {
              await db.movie.update({
                where: { id: m.id },
                data: {
                  posterUrl: tmdbMovie.poster_path
                    ? `${IMG_BASE}${tmdbMovie.poster_path}`
                    : "",
                  backdropUrl: tmdbMovie.backdrop_path
                    ? `${IMG_BASE}${tmdbMovie.backdrop_path}`
                    : null,
                  tmdbId: tmdbMovie.id || null,
                },
              });
              fetched++;
            }
          }
        } catch {
          // non-fatal — skip on error
        }
        await sleep(100);
      }
      console.log(`  artwork fetched from TMDB: ${fetched}`);
    }
  } catch {
    // non-fatal — artwork can be fetched separately via bun run fetch-artwork
  }

  console.log("Done. Video URLs are empty — paste your licensed stream URLs via the admin dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });

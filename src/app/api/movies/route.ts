import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit")) || 0, 5000);
  const offset = Math.max(Number(req.nextUrl.searchParams.get("offset")) || 0, 0);

  // case-insensitive partial matching
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { director: { contains: q, mode: "insensitive" as const } },
          { genre: { contains: q, mode: "insensitive" as const } },
          { cast: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : { type: "movie" }; // browse: only movies (series shown in separate reel)

  // For search queries, return all matches (needed for search results).
  // For browse (no query), limit to 200 movies sorted by popularity to keep
  // the initial payload small. The browse page builds reels from this subset.
  const useLimit = q ? false : limit > 0;

  const movies = await db.movie.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    ...(useLimit ? { take: limit, skip: offset } : {}),
    select: {
      id: true,
      title: true,
      slug: true,
      posterUrl: true,
      backdropUrl: true,
      videoUrl: true,
      subtitleUrl: true,
      tmdbId: true,
      type: true,
      imdbRank: true,
      duration: true,
      year: true,
      genre: true,
      director: true,
      rating: true,
      featured: true,
      isNew: true,
      isOriginal: true,
      isEditorsPick: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return NextResponse.json({ movies });
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

    const slug = String(body.slug ?? "").trim() || slugify(title);

    const movie = await db.movie.create({
      data: {
        title,
        slug,
        logline: String(body.logline ?? "").trim(),
        description: String(body.description ?? "").trim(),
        posterUrl: String(body.posterUrl ?? "").trim(),
        backdropUrl: String(body.backdropUrl ?? "").trim() || null,
        videoUrl:
          body.videoUrl == null
            ? null
            : String(body.videoUrl).trim() || null,
        imdbId:
          body.imdbId == null ? null : String(body.imdbId).trim() || null,
        imdbRank:
          body.imdbRank == null ? null : Number(body.imdbRank) || null,
        duration: Number(body.duration) || 0,
        year: Number(body.year) || 0,
        genre: String(body.genre ?? "").trim(),
        director: String(body.director ?? "").trim(),
        cast: String(body.cast ?? "").trim(),
        rating: Number(body.rating) || 0,
        featured: !!body.featured,
        isNew: !!body.isNew,
        isOriginal: !!body.isOriginal,
        isEditorsPick: !!body.isEditorsPick,
      },
    });

    return NextResponse.json({ movie });
  } catch (e: unknown) {
    console.error("[movies POST]", e);
    const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: unknown }).code) : "";
    if (msg === "P2002") {
      return NextResponse.json({ error: "That slug is already in use." }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not create movie." }, { status: 500 });
  }
}

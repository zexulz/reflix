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
  // case-insensitive partial matching — "dark" matches "The Dark Knight",
  // "batman" matches "Batman Begins", "nolan" matches any Nolan film, etc.
  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { director: { contains: q, mode: "insensitive" as const } },
          { genre: { contains: q, mode: "insensitive" as const } },
          { cast: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  // only select the fields needed for the browse/card view — skip heavy
  // text fields (description, cast, logline) that load in the detail modal.
  // This dramatically reduces the payload size for catalogs with thousands
  // of films.
  const movies = await db.movie.findMany({
    where,
    orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      logline: true,
      posterUrl: true,
      backdropUrl: true,
      videoUrl: true,
      imdbId: true,
      tmdbId: true,
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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const movie = await db.movie.findUnique({ where: { id } });
  if (!movie) return NextResponse.json({ error: "Movie not found." }, { status: 404 });
  return NextResponse.json({ movie });
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { id } = await params;
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const existing = await db.movie.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Movie not found." }, { status: 404 });

    const movie = await db.movie.update({
      where: { id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        slug: body.slug !== undefined ? String(body.slug).trim() || undefined : undefined,
        logline: body.logline !== undefined ? String(body.logline).trim() : undefined,
        description: body.description !== undefined ? String(body.description).trim() : undefined,
        posterUrl: body.posterUrl !== undefined ? String(body.posterUrl).trim() : undefined,
        backdropUrl:
          body.backdropUrl !== undefined
            ? String(body.backdropUrl).trim() || null
            : undefined,
        videoUrl:
          body.videoUrl === undefined
            ? undefined
            : body.videoUrl == null
              ? null
              : String(body.videoUrl).trim() || null,
        duration: body.duration !== undefined ? Number(body.duration) || 0 : undefined,
        year: body.year !== undefined ? Number(body.year) || 0 : undefined,
        genre: body.genre !== undefined ? String(body.genre).trim() : undefined,
        director: body.director !== undefined ? String(body.director).trim() : undefined,
        cast: body.cast !== undefined ? String(body.cast).trim() : undefined,
        rating: body.rating !== undefined ? Number(body.rating) || 0 : undefined,
        featured: body.featured !== undefined ? !!body.featured : undefined,
        isNew: body.isNew !== undefined ? !!body.isNew : undefined,
        isOriginal: body.isOriginal !== undefined ? !!body.isOriginal : undefined,
        isEditorsPick: body.isEditorsPick !== undefined ? !!body.isEditorsPick : undefined,
      },
    });

    return NextResponse.json({ movie });
  } catch (e) {
    console.error("[movies PUT]", e);
    return NextResponse.json({ error: "Could not update movie." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const { id } = await params;
    await db.movie.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[movies DELETE]", e);
    return NextResponse.json({ error: "Could not delete movie." }, { status: 500 });
  }
}

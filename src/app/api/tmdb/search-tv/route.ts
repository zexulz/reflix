import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (user.role !== "ADMIN")
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });

    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q) return NextResponse.json({ results: [] });
    if (!TMDB_KEY)
      return NextResponse.json({ error: "TMDB_API_KEY not configured." }, { status: 500 });

    const url = `${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}&include_adult=false&page=1`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "TMDB request failed." }, { status: 502 });
    const data = await res.json();

    const results = (data.results || []).map((r: any) => ({
      tmdbId: r.id,
      name: r.name,
      year: r.first_air_date ? Number(r.first_air_date.slice(0, 4)) : null,
      overview: r.overview || "",
      posterPath: r.poster_path,
      backdropPath: r.backdrop_path,
      rating: r.vote_average ? Math.round(r.vote_average * 10) / 10 : 0,
    }));

    return NextResponse.json({ results });
  } catch (e) {
    console.error("[tmdb search-tv]", e);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}

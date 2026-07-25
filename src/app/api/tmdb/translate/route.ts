import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = "https://api.themoviedb.org/3";

/*
  Fetches translated movie details (title, logline, description, genre) from TMDB
  in the user's selected language. Returns the translated fields which the
  frontend uses to override the English defaults from the database.

  GET /api/tmdb/translate?tmdbId=278&lang=es
*/
export async function GET(req: NextRequest) {
  try {
    const tmdbId = req.nextUrl.searchParams.get("tmdbId");
    const lang = req.nextUrl.searchParams.get("lang") || "en";

    if (!tmdbId) {
      return NextResponse.json({ error: "tmdbId is required." }, { status: 400 });
    }
    if (!TMDB_KEY) {
      return NextResponse.json({ error: "TMDB not configured." }, { status: 500 });
    }

    // map our language codes to TMDB's
    const tmdbLang: Record<string, string> = {
      en: "en-US",
      es: "es-ES",
      uk: "uk-UA",
    };
    const language = tmdbLang[lang] || "en-US";

    // try movie first, then TV show
    let res = await fetch(
      `${TMDB_BASE}/movie/${tmdbId}?api_key=${TMDB_KEY}&language=${language}`
    );
    let isTv = false;

    if (!res.ok) {
      // movie lookup failed — try TV
      res = await fetch(
        `${TMDB_BASE}/tv/${tmdbId}?api_key=${TMDB_KEY}&language=${language}`
      );
      isTv = res.ok;
    }

    if (!res.ok) {
      return NextResponse.json({ error: "TMDB lookup failed." }, { status: 502 });
    }

    const d = await res.json();

    return NextResponse.json({
      title: isTv ? (d.name || null) : (d.title || null),
      overview: d.overview || null,
      tagline: d.tagline || null,
      genres: d.genres?.map((g: any) => g.name) || [],
    });
  } catch (e) {
    console.error("[tmdb translate]", e);
    return NextResponse.json({ error: "Translation failed." }, { status: 500 });
  }
}

"use client";

import { useEffect, useMemo } from "react";
import { Providers } from "./providers";
import { useApp } from "@/lib/store";
import { useMe, useMovies, useProgress } from "@/lib/hooks";
import { Header } from "@/components/reflix/header";
import { Hero } from "@/components/reflix/hero";
import { Reel } from "@/components/reflix/reel";
import { LazyReel } from "@/components/reflix/lazy-reel";
import { Footer } from "@/components/reflix/footer";
import { COLLECTIONS } from "@/lib/collections";
import { MovieDetailModal } from "@/components/reflix/movie-detail-modal";
import { AuthModal } from "@/components/reflix/auth-modal";
import { Player } from "@/components/reflix/player";
import { AdminDashboard } from "@/components/reflix/admin-dashboard";
import { MovieCard } from "@/components/reflix/movie-card";
import { SprocketDivider } from "@/components/reflix/sprocket-divider";
import type { Movie } from "@/lib/types";

export default function Home() {
  return (
    <Providers>
      <App />
    </Providers>
  );
}

function App() {
  const user = useApp((s) => s.user);
  const setUser = useApp((s) => s.setUser);
  const view = useApp((s) => s.view);
  const playingMovie = useApp((s) => s.playingMovie);
  const search = useApp((s) => s.search);
  const myList = useApp((s) => s.myList);
  const openAuth = useApp((s) => s.openAuth);

  const me = useMe();
  const moviesQ = useMovies();
  const progressQ = useProgress();

  // sync session into store
  useEffect(() => {
    if (me.data !== undefined) setUser(me.data);
  }, [me.data, setUser]);

  const movies = useMemo<Movie[]>(() => moviesQ.data ?? [], [moviesQ.data]);

  const progressMap = useMemo(() => {
    const map: Record<string, { position: number; duration: number }> = {};
    for (const p of progressQ.data ?? []) {
      map[p.movieId] = { position: p.position, duration: p.duration };
    }
    return map;
  }, [progressQ.data]);

  if (view === "admin") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          <AdminDashboard />
        </main>
        <Footer />
        <AuthModal />
        <MovieDetailModal />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="flex-1">
        {search ? (
          <SearchResults movies={movies} query={search} />
        ) : (
          <Browse
            movies={movies}
            user={user}
            myList={myList}
            progressMap={progressMap}
            onSignIn={() => openAuth("signin")}
          />
        )}
      </main>
      <Footer />
      <MovieDetailModal />
      <AuthModal />
      {playingMovie && <Player />}
    </div>
  );
}

function Browse({
  movies,
  user,
  myList,
  progressMap,
  onSignIn,
}: {
  movies: Movie[];
  user: { id: string; role: "USER" | "ADMIN" } | null;
  myList: string[];
  progressMap: Record<string, { position: number; duration: number }>;
  onSignIn: () => void;
}) {
  // build the program of reels — a real sequence, so REEL numbering is truthful
  const reels: {
    id: string;
    title: string;
    items: Movie[];
    progressMap?: Record<string, { position: number; duration: number }>;
    emptyMessage?: string;
  }[] = [];

  // Popularity sort: newer + higher-rated films first.
  // Score = rating * (1 + recency_bonus) where recency_bonus gives newer films a boost.
  const byPopularity = (a: Movie, b: Movie) => {
    const score = (m: Movie) => {
      const recency = m.year >= 2023 ? 3 : m.year >= 2020 ? 2 : m.year >= 2015 ? 1 : 0;
      return m.rating + recency;
    };
    return score(b) - score(a);
  };

  const continueMovies = movies.filter(
    (m) => progressMap[m.id] && progressMap[m.id].duration > 0
  );
  if (user && continueMovies.length > 0) {
    reels.push({
      id: "reel-continue",
      title: "Continue Watching",
      items: continueMovies.sort(
        (a, b) =>
          (progressMap[b.id]?.position ?? 0) - (progressMap[a.id]?.position ?? 0)
      ),
      progressMap,
    });
  }

  // Trending Now — the most popular recent films across the whole catalog
  const trending = [...movies].sort(byPopularity).slice(0, 25);
  reels.push({ id: "reel-trending", title: "Trending Now", items: trending });

  // IMDb Top 25
  const byRank = [...movies]
    .filter((m) => m.imdbRank != null)
    .sort((a, b) => (a.imdbRank ?? 999) - (b.imdbRank ?? 999));
  if (byRank.length > 0) {
    reels.push({ id: "reel-top25", title: "The Top 25", items: byRank.slice(0, 25) });
  }

  const myListMovies = myList
    .map((id) => movies.find((m) => m.id === id))
    .filter((m): m is Movie => !!m);
  if (user) {
    reels.push({
      id: "reel-mylist",
      title: "My List",
      items: myListMovies,
      emptyMessage: "Your list is empty. Tap the + on any film to save it here.",
    });
  }

  // Genre reels — each genre sorted by popularity (newer + higher-rated first)
  const genreBuckets = new Map<string, Movie[]>();
  for (const m of movies) {
    if (!m.genre) continue;
    const arr = genreBuckets.get(m.genre) ?? [];
    arr.push(m);
    genreBuckets.set(m.genre, arr);
  }
  const genreOrder = ["Action", "Drama", "Comedy", "Adventure", "Animation", "Horror", "Science Fiction", "Crime", "Thriller", "Fantasy", "Biography", "Mystery", "War", "Western", "Romance", "Sports"];
  for (const g of genreOrder) {
    const items = genreBuckets.get(g);
    if (items && items.length >= 4) {
      items.sort(byPopularity);
      reels.push({ id: `reel-genre-${g.toLowerCase().replace(/\s+/g, "-")}`, title: g, items });
    }
  }

  // Studio collection reels — sorted by popularity
  for (const col of COLLECTIONS) {
    const idSet = new Set(col.tmdbIds);
    const items = movies.filter((m) => m.tmdbId != null && idSet.has(m.tmdbId));
    if (items.length > 0) {
      items.sort(byPopularity);
      reels.push({
        id: col.id,
        title: col.title,
        items,
      });
    }
  }

  // Decade reels — sorted by popularity within each era
  const decades: { label: string; from: number; to: number }[] = [
    { label: "Modern Cinema · 2000s–Now", from: 2000, to: 2099 },
    { label: "The Blockbuster Era · 1980s–1990s", from: 1980, to: 1999 },
    { label: "New Hollywood · 1960s–1970s", from: 1960, to: 1979 },
    { label: "The Classics · 1920s–1950s", from: 1920, to: 1959 },
  ];
  for (const d of decades) {
    const items = movies.filter((m) => m.year >= d.from && m.year <= d.to);
    if (items.length >= 4) {
      items.sort(byPopularity);
      reels.push({ id: `reel-decade-${d.from}`, title: d.label, items });
    }
  }

  // Full catalog — sorted by popularity
  const fullCatalog = [...movies].sort(byPopularity);
  reels.push({ id: "reel-catalog", title: "Browse All", items: fullCatalog });

  return (
    <>
      <Hero movies={movies} />

      <div className="relative z-10 space-y-8 pb-24 pt-8 sm:space-y-10 sm:pt-12">
        {reels.map((r, i) => (
          <LazyReel key={r.id}>
            <Reel
              id={r.id}
              reel={i + 2}
              title={r.title}
              movies={r.items}
              progressMap={r.progressMap}
              emptyMessage={r.emptyMessage}
            />
          </LazyReel>
        ))}

        {!user && (
          <section className="px-4 sm:px-8">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-hairline bg-ink-2/80 backdrop-blur-sm">
              <div className="flex flex-col items-start gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-glow-soft">
                    Become a member
                  </div>
                  <h3 className="mt-2 font-display text-3xl tracking-tight text-bone">
                    Make a list. Resume anywhere.
                  </h3>
                  <p className="mt-2 max-w-md font-sans text-sm text-ash">
                    Create a free account to save films, pick up where you left off,
                    and keep your reel of personal picks.
                  </p>
                </div>
                <button
                  onClick={onSignIn}
                  className="shrink-0 rounded-full bg-glow px-6 py-3 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
                >
                  Create account
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function SearchResults({ movies, query }: { movies: Movie[]; query: string }) {
  return (
    <div className="px-4 pb-24 pt-24 sm:px-8">
      <div className="mb-6">
        <SprocketDivider title={`Search · ${query}`} />
      </div>
      {movies.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-3xl text-bone">No films matched.</p>
          <p className="mt-2 font-sans text-sm text-ash">
            Try a different title, director, or genre.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 sm:gap-4">
          {movies.map((m) => (
            <MovieCard key={m.id} movie={m} width="w-full" progress={null} />
          ))}
        </div>
      )}
    </div>
  );
}

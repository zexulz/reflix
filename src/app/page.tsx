"use client";

import { useEffect, useMemo } from "react";
import { Providers } from "./providers";
import { useApp } from "@/lib/store";
import { useMe, useMovies, useProgress, useSeries } from "@/lib/hooks";
import { Header } from "@/components/reflix/header";
import { Hero } from "@/components/reflix/hero";
import { Reel } from "@/components/reflix/reel";
import { LazyReel } from "@/components/reflix/lazy-reel";
import { Footer } from "@/components/reflix/footer";
import { LanguageGate } from "@/components/reflix/language-gate";
import { useLanguage } from "@/lib/lang-store";
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
  const seriesQ = useSeries();
  const progressQ = useProgress();

  // sync session into store
  useEffect(() => {
    if (me.data !== undefined) setUser(me.data);
  }, [me.data, setUser]);

  const movies = useMemo<Movie[]>(() => moviesQ.data ?? [], [moviesQ.data]);
  const series = useMemo<Movie[]>(() => seriesQ.data ?? [], [seriesQ.data]);

  const progressMap = useMemo(() => {
    const map: Record<string, { position: number; duration: number }> = {};
    for (const p of progressQ.data ?? []) {
      map[p.movieId] = { position: p.position, duration: p.duration };
    }
    return map;
  }, [progressQ.data]);

  if (view === "admin") {
    return (
      <LanguageGate>
        <div className="flex min-h-screen flex-col bg-background">
          <Header />
          <main className="flex-1">
            <AdminDashboard />
          </main>
          <Footer />
          <AuthModal />
          <MovieDetailModal />
        </div>
      </LanguageGate>
    );
  }

  return (
    <LanguageGate>
      <div className="flex min-h-screen flex-col bg-background">
        <Header />
        <main className="flex-1">
          {search ? (
            <SearchResults movies={movies} query={search} />
          ) : (
            <Browse
              movies={movies}
              series={series}
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
    </LanguageGate>
  );
}

function Browse({
  movies,
  user,
  myList,
  progressMap,
  onSignIn,
  series,
}: {
  movies: Movie[];
  series: Movie[];
  user: { id: string; role: "USER" | "ADMIN" } | null;
  myList: string[];
  progressMap: Record<string, { position: number; duration: number }>;
  onSignIn: () => void;
}) {
  // build the program of reels — a real sequence, so REEL numbering is truthful
  const t = useLanguage((s) => s.t);
  const tg = useLanguage((s) => s.tg);
  const reels: {
    id: string;
    title: string;
    items: Movie[];
    progressMap?: Record<string, { position: number; duration: number }>;
    emptyMessage?: string;
  }[] = [];

  // Popularity sort: newer + higher-rated films first.
  const byPopularity = (a: Movie, b: Movie) => {
    const score = (m: Movie) => {
      const recency = m.year >= 2023 ? 3 : m.year >= 2020 ? 2 : m.year >= 2015 ? 1 : 0;
      return m.rating + recency;
    };
    return score(b) - score(a);
  };

  // Filter out short movies (< 40 min) — they clutter the reels
  const fullLengthMovies = movies.filter((m) => m.duration >= 40 || m.duration === 0);

  const continueMovies = movies.filter(
    (m) => progressMap[m.id] && progressMap[m.id].duration > 0
  );
  if (user && continueMovies.length > 0) {
    reels.push({
      id: "reel-continue",
      title: t("reel.continueWatching"),
      items: continueMovies.sort(
        (a, b) =>
          (progressMap[b.id]?.position ?? 0) - (progressMap[a.id]?.position ?? 0)
      ),
      progressMap,
    });
  }

  // Trending Now — the most popular recent films across the whole catalog
  const trending = [...fullLengthMovies].sort(byPopularity).slice(0, 25);
  reels.push({ id: "reel-trending", title: t("reel.trending"), items: trending });

  // IMDb Top 25
  const byRank = [...fullLengthMovies]
    .filter((m) => m.imdbRank != null)
    .sort((a, b) => (a.imdbRank ?? 999) - (b.imdbRank ?? 999));
  if (byRank.length > 0) {
    reels.push({ id: "reel-top25", title: t("reel.top25"), items: byRank.slice(0, 25) });
  }

  const myListMovies = myList
    .map((id) => fullLengthMovies.find((m) => m.id === id))
    .filter((m): m is Movie => !!m);
  if (user) {
    reels.push({
      id: "reel-mylist",
      title: t("reel.myList"),
      items: myListMovies,
      emptyMessage: t("reel.myListEmpty"),
    });
  }

  // Genre reels — each genre sorted by popularity (newer + higher-rated first)
  const genreBuckets = new Map<string, Movie[]>();
  for (const m of fullLengthMovies) {
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
      reels.push({ id: `reel-genre-${g.toLowerCase().replace(/\s+/g, "-")}`, title: tg(g), items });
    }
  }

  // Studio collection reels — sorted by popularity
  for (const col of COLLECTIONS) {
    const idSet = new Set(col.tmdbIds);
    const items = fullLengthMovies.filter((m) => m.tmdbId != null && idSet.has(m.tmdbId));
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
  const decadeLabels = [
    { key: "reel.decade.modern", from: 2000, to: 2099 },
    { key: "reel.decade.blockbuster", from: 1980, to: 1999 },
    { key: "reel.decade.newHollywood", from: 1960, to: 1979 },
    { key: "reel.decade.classics", from: 1920, to: 1959 },
  ];
  for (const d of decadeLabels) {
    const items = fullLengthMovies.filter((m) => m.year >= d.from && m.year <= d.to);
    if (items.length >= 4) {
      items.sort(byPopularity);
      reels.push({ id: `reel-decade-${d.from}`, title: t(d.key), items });
    }
  }

  // Series reel — uses the dedicated series API (separate from movies)
  if (series.length >= 1) {
    const sortedSeries = [...series].sort(byPopularity);
    reels.push({ id: "reel-series", title: t("reel.series"), items: sortedSeries });
  }

  // Full catalog — sorted by popularity
  const fullCatalog = [...fullLengthMovies].sort(byPopularity);
  reels.push({ id: "reel-catalog", title: t("reel.browseAll"), items: fullCatalog });

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
                    {t("member.becomeMember")}
                  </div>
                  <h3 className="mt-2 font-display text-3xl tracking-tight text-bone">
                    {t("member.makeList")}
                  </h3>
                  <p className="mt-2 max-w-md font-sans text-sm text-ash">
                    {t("member.desc")}
                  </p>
                </div>
                <button
                  onClick={onSignIn}
                  className="shrink-0 rounded-full bg-glow px-6 py-3 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
                >
                  {t("member.createAccount")}
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
  const t = useLanguage((s) => s.t);
  return (
    <div className="px-4 pb-24 pt-24 sm:px-8">
      <div className="mb-6">
        <SprocketDivider title={`${t("nav.search")} · ${query}`} />
      </div>
      {movies.length === 0 ? (
        <div className="py-20 text-center">
          <p className="font-display text-3xl text-bone">{t("search.noResults")}</p>
          <p className="mt-2 font-sans text-sm text-ash">{t("search.tryAgain")}</p>
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

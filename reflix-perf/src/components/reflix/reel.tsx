"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MovieCard } from "./movie-card";
import { SprocketDivider } from "./sprocket-divider";
import type { Movie } from "@/lib/types";

type ProgressMap = Record<string, { position: number; duration: number }>;

const BATCH_SIZE = 12; // render 12 cards at a time, load more on scroll

export function Reel({
  id,
  reel,
  title,
  movies,
  progressMap,
  emptyMessage,
}: {
  id?: string;
  reel: number;
  title: string;
  movies: Movie[];
  progressMap?: ProgressMap;
  emptyMessage?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: "smooth" });
  };

  // load more cards when the sentinel (trailing spacer) enters view
  const loadMore = useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + BATCH_SIZE, movies.length));
  }, [movies.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = ref.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { root: container, rootMargin: "0px 200px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  if (movies.length === 0 && !emptyMessage) return null;

  const visibleMovies = movies.slice(0, visibleCount);
  const hasMore = visibleCount < movies.length;

  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 px-4 sm:px-8">
        <SprocketDivider reel={reel} title={title} />
      </div>

      <div className="group/reel relative">
        {/* edge arrows (desktop) */}
        <button
          onClick={() => scroll(-1)}
          aria-label="Scroll left"
          className="absolute left-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-r from-ink via-ink/70 to-transparent text-bone opacity-0 transition-opacity hover:text-glow group-hover/reel:opacity-100 md:flex"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          onClick={() => scroll(1)}
          aria-label="Scroll right"
          className="absolute right-0 top-0 z-20 hidden h-full w-12 items-center justify-center bg-gradient-to-l from-ink via-ink/70 to-transparent text-bone opacity-0 transition-opacity hover:text-glow group-hover/reel:opacity-100 md:flex"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        {movies.length === 0 ? (
          <div className="px-4 sm:px-8 py-10 text-center">
            <p className="font-sans text-sm text-ash">{emptyMessage}</p>
          </div>
        ) : (
          <div
            ref={ref}
            className="no-scrollbar rfx-scroll flex gap-3 overflow-x-auto scroll-smooth px-4 pb-3 sm:gap-4 sm:px-8"
          >
            {visibleMovies.map((m) => (
              <MovieCard
                key={m.id}
                movie={m}
                progress={progressMap?.[m.id]}
              />
            ))}
            {/* sentinel — when this scrolls into view, load more cards */}
            {hasMore && (
              <div ref={sentinelRef} className="flex w-12 shrink-0 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-glow opacity-40" />
              </div>
            )}
            {/* trailing spacer */}
            <div className="w-1 shrink-0" aria-hidden />
          </div>
        )}
      </div>
    </section>
  );
}

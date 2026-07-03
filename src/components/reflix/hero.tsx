"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Play, Plus, Check, Star } from "lucide-react";
import { useApp } from "@/lib/store";
import { formatRuntime, type Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Hero({ movies }: { movies: Movie[] }) {
  const featured = movies.filter((m) => m.featured);
  const pool = featured.length > 0 ? featured : movies.slice(0, 1);
  const [idx, setIdx] = useState(0);

  const myList = useApp((s) => s.myList);
  const toggleList = useApp((s) => s.toggleList);
  const play = useApp((s) => s.play);
  const openDetail = useApp((s) => s.openDetail);

  useEffect(() => {
    if (pool.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % pool.length), 9000);
    return () => clearInterval(t);
  }, [pool.length]);

  if (pool.length === 0) {
    return <div className="h-[60vh] min-h-[420px] bg-ink-2" />;
  }

  const movie = pool[idx % pool.length];
  const inList = myList.includes(movie.id);
  const hasArtwork = !!(movie.backdropUrl || movie.posterUrl);

  return (
    <section className="film-grain projector-vignette relative h-[82vh] min-h-[540px] w-full overflow-hidden">
      {/* crossfading backdrop */}
      <AnimatePresence mode="sync">
        <motion.div
          key={movie.id}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 1.1 }, scale: { duration: 9, ease: "linear" } }}
          className="absolute inset-0"
        >
          {hasArtwork ? (
            <Image
              src={movie.backdropUrl || movie.posterUrl}
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover"
            />
          ) : (
            // no artwork attached — a deliberate cinematic gradient field with
            // the title rendered enormous in the display serif, off to the
            // right edge, so it reads as an intentional poster, not a void
            <div className="absolute inset-0 bg-gradient-to-br from-[#161821] via-[#0d0e14] to-[#08090d]">
              <div className="absolute inset-6 border border-glow/10" />
              <div className="absolute -right-[6vw] top-1/2 hidden -translate-y-1/2 select-none sm:block">
                <span className="block max-w-[60vw] break-words text-right font-display text-[14vw] leading-[0.85] tracking-tight text-bone/[0.06]">
                  {movie.title}
                </span>
              </div>
              <div className="absolute right-6 top-6 font-mono text-[10px] uppercase tracking-[0.3em] text-glow-soft/40">
                {movie.imdbRank ? `IMDb · No. ${movie.imdbRank}` : ""}
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* warm wash so text always reads on top of the grain/vignette layers */}
      <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-t from-ink via-ink/40 to-transparent" />
      <div className="pointer-events-none absolute inset-0 z-[3] bg-gradient-to-r from-ink/85 via-ink/30 to-transparent" />

      {/* content */}
      <div className="relative z-[4] mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-14 sm:px-8 sm:pb-20">
        <div className="max-w-2xl">
          {/* eyebrow: now showing marquee */}
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="bulb h-1.5 w-1.5 rounded-full bg-glow" />
              <span className="bulb h-1.5 w-1.5 rounded-full bg-glow" />
              <span className="bulb h-1.5 w-1.5 rounded-full bg-glow" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-bone/70">
              Now Showing
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-ash">
              · REEL 01 / FEATURED
            </span>
          </div>

          {/* title — the thesis, set in the display serif. */}
          <motion.h1
            key={movie.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="font-display text-[13vw] leading-[0.92] tracking-tight text-bone sm:text-7xl md:text-8xl"
          >
            {movie.title}
          </motion.h1>

          {/* meta row */}
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
            <span className="text-glow-soft">{movie.year}</span>
            <span className="text-hairline">·</span>
            <span>{formatRuntime(movie.duration)}</span>
            <span className="text-hairline">·</span>
            <span>{movie.genre}</span>
            <span className="text-hairline">·</span>
            <span className="inline-flex items-center gap-1 text-bone/80">
              <Star className="h-3 w-3 fill-glow text-glow" />
              {movie.rating.toFixed(1)}
            </span>
            {movie.isOriginal && (
              <span className="ml-1 rounded-md border border-glow/40 bg-glow/5 px-1.5 py-0.5 text-[9px] tracking-[0.2em] text-glow-soft backdrop-blur-sm">
                Reflix Original
              </span>
            )}
          </div>

          {/* logline */}
          <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-bone/80 text-balance sm:text-lg">
            {movie.logline}
          </p>

          {/* CTAs */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              onClick={() => play(movie)}
              className="group flex items-center gap-2.5 rounded-full bg-glow px-7 py-3 font-sans text-sm font-semibold text-ink transition-all duration-300 hover:bg-glow-soft hover:shadow-[0_0_40px_-6px_var(--glow)] hover:scale-[1.02]"
            >
              <Play className="h-4 w-4 fill-ink transition-transform group-hover:scale-110" />
              Play
            </button>
            <button
              onClick={() => openDetail(movie)}
              className="flex items-center gap-2 rounded-full border border-hairline bg-ink/40 px-6 py-3 font-sans text-sm text-bone backdrop-blur-md transition-all duration-300 hover:border-bone/30 hover:bg-ink-3"
            >
              More info
            </button>
            <button
              onClick={() => toggleList(movie.id)}
              aria-label={inList ? "Remove from list" : "Add to list"}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-300",
                inList
                  ? "border-glow/50 bg-glow/15 text-glow shadow-[0_0_20px_-6px_var(--glow)]"
                  : "border-hairline bg-ink/40 text-bone hover:border-bone/30 hover:bg-ink-3"
              )}
            >
              {inList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* dot indicators */}
        {pool.length > 1 && (
          <div className="mt-10 flex items-center gap-2">
            {pool.map((m, i) => (
              <button
                key={m.id}
                onClick={() => setIdx(i)}
                aria-label={`Show ${m.title}`}
                className={cn(
                  "h-[3px] rounded-full transition-all duration-500 ease-out",
                  i === idx
                    ? "w-10 bg-glow shadow-[0_0_8px_var(--glow)]"
                    : "w-4 bg-hairline hover:bg-ash"
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

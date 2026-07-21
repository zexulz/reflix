"use client";

import { Play, Plus, Check } from "lucide-react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useApp } from "@/lib/store";
import { useLanguage } from "@/lib/lang-store";
import { formatRuntime, type Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MovieCard({
  movie,
  progress,
  width = "w-[42vw] sm:w-[200px] md:w-[210px]",
}: {
  movie: Movie;
  progress?: { position: number; duration: number } | null;
  width?: string;
}) {
  const openDetail = useApp((s) => s.openDetail);
  const toggleList = useApp((s) => s.toggleList);
  const inList = useApp((s) => s.myList.includes(movie.id));
  const tg = useLanguage((s) => s.tg);
  const language = useLanguage((s) => s.language);

  const pct =
    progress && progress.duration > 0
      ? Math.min(100, Math.round((progress.position / progress.duration) * 100))
      : null;

  const hasPoster = !!movie.posterUrl;
  // when no artwork is attached, render a deliberate typographic title card
  // (Criterion-style minimalist cover) instead of a broken-image placeholder
  const hasStream = !!movie.videoUrl;

  return (
    <div className={cn("group relative shrink-0", width)}>
      <button
        onClick={() => openDetail(movie)}
        className="card-lift relative block w-full overflow-hidden rounded-xl bg-ink-2 text-left ring-1 ring-hairline/70 hover:ring-glow/50 hover:shadow-[0_24px_50px_-20px_rgba(0,0,0,0.9),0_0_30px_-10px_var(--glow)]"
        style={{ aspectRatio: "2 / 3" }}
      >
        {hasPoster ? (
          <Image
            src={movie.posterUrl}
            alt={movie.title}
            fill
            loading="lazy"
            sizes="(max-width: 640px) 44vw, 210px"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <TitleCard movie={movie} />
        )}

        {/* bottom gradient — title always legible, refined for cleaner fade */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent opacity-90" />

        {/* rating chip */}
        <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-ink/70 px-1.5 py-0.5 backdrop-blur-md ring-1 ring-white/5">
          <span className="h-1.5 w-1.5 rounded-full bg-glow shadow-[0_0_4px_var(--glow)]" />
          <span className="font-mono text-[10px] font-medium tabular-nums text-bone">
            {movie.rating.toFixed(1)}
          </span>
        </div>

        {/* NEW / IMDb rank flag */}
        {movie.isNew ? (
          <div className="absolute left-2 top-2 rounded-md bg-glow px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-ink shadow-[0_0_12px_-2px_var(--glow)]">
            {language === "es" ? "Nuevo" : language === "uk" ? "Нове" : "New"}
          </div>
        ) : movie.imdbRank ? (
          <div className="absolute left-2 top-2 rounded-md border border-glow/30 bg-ink/60 px-1.5 py-0.5 font-mono text-[9px] font-medium tabular-nums text-glow-soft backdrop-blur-md">
            #{movie.imdbRank}
          </div>
        ) : null}

        {/* hover play affordance — only if a stream is attached */}
        {hasStream && (
          <motion.div
            initial={false}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="flex h-14 w-14 translate-y-2 scale-90 items-center justify-center rounded-full bg-glow text-ink opacity-0 shadow-[0_0_30px_-4px_var(--glow)] transition-all duration-400 ease-out group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100">
              <Play className="h-5 w-5 fill-ink pl-0.5" />
            </div>
          </motion.div>
        )}

        {/* title block */}
        <div className="absolute inset-x-0 bottom-0 p-3">
          <div className="line-clamp-2 font-sans text-sm font-medium leading-tight text-bone">
            {movie.title}
          </div>
          <div className="mt-1 flex items-center gap-1.5 font-mono text-[10px] text-ash">
            <span>{movie.year}</span>
            <span className="text-hairline">·</span>
            <span>{formatRuntime(movie.duration)}</span>
            <span className="text-hairline">·</span>
            <span className="truncate">{tg(movie.genre)}</span>
          </div>
        </div>

        {/* progress bar */}
        {pct != null && (
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-ink-3/80">
            <div className="h-full bg-glow" style={{ width: `${pct}%` }} />
          </div>
        )}
      </button>

      {/* add-to-list */}
      <button
        onClick={() => toggleList(movie.id)}
        aria-label={inList ? "Remove from list" : "Add to list"}
        className={cn(
          "absolute -right-1.5 -top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-sm transition-all",
          inList
            ? "border-glow/40 bg-glow text-ink"
            : "border-hairline bg-ink/80 text-bone/70 opacity-0 hover:text-bone group-hover:opacity-100"
        )}
      >
        {inList ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

/*
  TitleCard — the deliberate typographic cover used when a film has no artwork
  attached yet. A warm-ink gradient field with the title set in the display
  serif, the year, and the director. Reads as an intentional minimalist design
  (Criterion-esque), not a placeholder.
*/
function TitleCard({ movie }: { movie: Movie }) {
  // modern cool gradient variants — subtle variety so the reel has rhythm
  const variants = [
    "from-[#161821] via-[#0d0e14] to-[#08090d]",
    "from-[#181a25] via-[#0e0f15] to-[#08090d]",
    "from-[#141620] via-[#0c0d13] to-[#08090d]",
    "from-[#1a1c28] via-[#0f1016] to-[#08090d]",
  ];
  const variant = movie.imdbRank
    ? variants[movie.imdbRank % variants.length]
    : variants[0];

  return (
    <div
      className={cn(
        "absolute inset-0 flex flex-col justify-between bg-gradient-to-br p-4",
        variant
      )}
    >
      {/* hairline frame — refined for the cooler palette */}
      <div className="pointer-events-none absolute inset-2.5 border border-glow/10" />

      {/* top: rank / year */}
      <div className="relative flex items-start justify-between">
        <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-glow-soft/80">
          {movie.imdbRank ? `No. ${movie.imdbRank}` : movie.year}
        </span>
        <span className="font-mono text-[9px] tabular-nums text-ash">
          {movie.imdbRank ? movie.year : ""}
        </span>
      </div>

      {/* middle: title in display serif */}
      <div className="relative">
        <h3 className="font-display text-[15px] leading-[1.05] tracking-tight text-bone">
          {movie.title}
        </h3>
        {movie.director && (
          <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.18em] text-ash">
            {movie.director}
          </div>
        )}
      </div>

      {/* bottom: genre */}
      <div className="relative font-mono text-[8px] uppercase tracking-[0.25em] text-ash/70">
        {movie.genre}
      </div>
    </div>
  );
}

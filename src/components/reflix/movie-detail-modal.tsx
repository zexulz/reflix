"use client";

import Image from "next/image";
import { Play, Plus, Check, Star, Clapperboard, User, Film, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/store";
import { useProgress } from "@/lib/hooks";
import { formatRuntime, type Movie } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MovieDetailModal() {
  const movie = useApp((s) => s.detailMovie);
  const closeDetail = useApp((s) => s.closeDetail);
  const play = useApp((s) => s.play);
  const toggleList = useApp((s) => s.toggleList);
  const myList = useApp((s) => s.myList);
  const user = useApp((s) => s.user);
  const setView = useApp((s) => s.setView);
  const openAdminForm = useApp((s) => s.openAdminForm);
  const { data: progress } = useProgress();

  const open = !!movie;
  const prog = movie && progress ? progress.find((p) => p.movieId === movie.id) : null;
  const inList = movie ? myList.includes(movie.id) : false;
  const resumePct =
    prog && prog.duration > 0
      ? Math.min(100, Math.round((prog.position / prog.duration) * 100))
      : 0;

  const handlePlay = (m: Movie) => {
    closeDetail();
    play(m);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeDetail()}>
      <DialogContent
        className="max-h-[92vh] w-[96vw] max-w-3xl overflow-hidden rounded-xl border-hairline bg-ink-2 p-0 rfx-scroll"
      >
        {movie && (
          <>
            <DialogTitle className="sr-only">{movie.title}</DialogTitle>
            {/* backdrop — falls back to a cinematic gradient field when no
                artwork is attached, matching the hero's no-artwork treatment */}
            <div className="relative h-56 w-full overflow-hidden sm:h-72">
              {movie.backdropUrl || movie.posterUrl ? (
                <Image
                  src={movie.backdropUrl || movie.posterUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 96vw, 768px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[#1a1209] via-[#100a06] to-[#0c0907]">
                  <div className="absolute inset-4 border border-glow/10" />
                  <div className="absolute right-5 top-5 font-mono text-[10px] uppercase tracking-[0.3em] text-glow-soft/50">
                    {movie.imdbRank ? `IMDb · No. ${movie.imdbRank}` : ""}
                  </div>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-2 via-ink-2/30 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-ink-2/60 to-transparent" />

              {/* close-ish quick actions over backdrop */}
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between gap-3">
                <div>
                  {movie.isOriginal && (
                    <span className="mb-2 inline-block rounded-[3px] border border-glow/40 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-glow-soft">
                      Reflix Original
                    </span>
                  )}
                  <h2 className="font-display text-4xl leading-none tracking-tight text-bone sm:text-5xl">
                    {movie.title}
                  </h2>
                </div>
              </div>
            </div>

            {/* body */}
            <div className="px-5 pb-6 pt-4 sm:px-7">
              {/* meta */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] uppercase tracking-[0.18em] text-ash">
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
              </div>

              {/* CTAs */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handlePlay(movie)}
                  className="flex items-center gap-2.5 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
                >
                  <Play className="h-4 w-4 fill-ink" />
                  {prog ? `Resume · ${resumePct}%` : "Play"}
                </button>
                <button
                  onClick={() => toggleList(movie.id)}
                  className={cn(
                    "flex h-11 w-11 items-center justify-center rounded-full border transition-all",
                    inList
                      ? "border-glow/50 bg-glow/15 text-glow"
                      : "border-hairline text-bone hover:border-bone/30 hover:bg-ink-3"
                  )}
                  aria-label={inList ? "Remove from list" : "Add to list"}
                >
                  {inList ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </button>
                {user?.role === "ADMIN" && (
                  <button
                    onClick={() => {
                      const m = movie;
                      openAdminForm(m);
                      closeDetail();
                      setView("admin");
                    }}
                    className="ml-auto flex items-center gap-1.5 rounded-full border border-hairline px-4 py-2 font-sans text-xs text-bone/80 transition-colors hover:border-glow/40 hover:text-glow-soft"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </button>
                )}
              </div>

              {/* progress bar */}
              {prog && (
                <div className="mt-4">
                  <div className="h-1 w-full overflow-hidden rounded-full bg-ink-3">
                    <div className="h-full bg-glow" style={{ width: `${resumePct}%` }} />
                  </div>
                </div>
              )}

              {/* logline */}
              <p className="mt-5 font-display text-xl italic leading-snug text-bone/90">
                {movie.logline}
              </p>

              {/* description */}
              <p className="mt-4 font-sans text-sm leading-relaxed text-ash">
                {movie.description}
              </p>

              {/* credits */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
                <Credit icon={<Clapperboard className="h-3.5 w-3.5" />} label="Director" value={movie.director} />
                <Credit icon={<Film className="h-3.5 w-3.5" />} label="Genre" value={movie.genre} />
                <Credit icon={<User className="h-3.5 w-3.5" />} label="Cast" value={movie.cast} />
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Credit({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-sans text-sm text-bone/90">{value}</div>
    </div>
  );
}

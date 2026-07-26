"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Play, Plus, Check, Star, Clapperboard, User, Film, Pencil, Tv } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp } from "@/lib/store";
import { useLanguage } from "@/lib/lang-store";
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
  const t = useLanguage((s) => s.t);
  const tg = useLanguage((s) => s.tg);
  const language = useLanguage((s) => s.language);

  // fetch translated movie data (title, overview, genre) from TMDB when the
  // modal opens and the user has a non-English language selected
  const [translated, setTranslated] = useState<{
    title?: string;
    overview?: string;
    genre?: string;
  }>({});

  // episode state for series
  const [episodes, setEpisodes] = useState<Record<number, Array<{
    id: string; season: number; episode: number; title: string; videoUrl: string | null;
  }>>>({});
  const [selectedSeason, setSelectedSeason] = useState(1);

  useEffect(() => {
    if (!movie || !movie.tmdbId || language === "en" || !language) {
      return;
    }
    let cancelled = false;
    fetch(`/api/tmdb/translate?tmdbId=${movie.tmdbId}&lang=${language}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.title) {
          setTranslated({
            title: data.title,
            overview: data.overview,
            genre: data.genres?.[0],
          });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.id, movie?.tmdbId, language]);

  // fetch episodes when a series detail modal opens
  useEffect(() => {
    if (!movie || movie.type !== "series") {
      return;
    }
    let cancelled = false;
    fetch(`/api/series/${movie.id}/episodes`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.seasons) {
          setEpisodes(data.seasons);
          // set selected season to the first available
          const firstSeason = Object.keys(data.seasons).map(Number).sort((a, b) => a - b)[0];
          if (firstSeason) setSelectedSeason(firstSeason);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [movie?.id, movie?.type]);

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
        className="max-h-[92vh] w-[96vw] max-w-3xl overflow-y-auto overflow-x-hidden rounded-xl border-hairline bg-ink-2 p-0 rfx-scroll"
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
                    {movie.imdbRank ? (language === "es" ? `IMDb · Nº ${movie.imdbRank}` : language === "uk" ? `IMDb · № ${movie.imdbRank}` : `IMDb · No. ${movie.imdbRank}`) : ""}
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
                      {language === "es" ? "Original de Reflix" : language === "uk" ? "Оригінал Reflix" : "Reflix Original"}
                    </span>
                  )}
                  <h2 className="font-display text-4xl leading-none tracking-tight text-bone sm:text-5xl">
                    {translated.title || movie.title}
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
                <span>{tg(movie.genre)}</span>
                <span className="text-hairline">·</span>
                <span className="inline-flex items-center gap-1 text-bone/80">
                  <Star className="h-3 w-3 fill-glow text-glow" />
                  {movie.rating.toFixed(1)}
                </span>
              </div>

              {/* CTAs — for series, the play button is hidden (episodes are listed below) */}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                {movie.type !== "series" && (
                  <button
                    onClick={() => handlePlay(movie)}
                    className="flex items-center gap-2.5 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
                  >
                    <Play className="h-4 w-4 fill-ink" />
                    {prog ? `${resumePct}%` : t("detail.play")}
                  </button>
                )}
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
                    {t("detail.edit")}
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

              {/* description — uses TMDB-translated overview if available */}
              <p className="mt-4 font-sans text-sm leading-relaxed text-ash">
                {translated.overview || movie.description || movie.logline}
              </p>

              {/* credits */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-t border-hairline pt-5 sm:grid-cols-3">
                <Credit icon={<Clapperboard className="h-3.5 w-3.5" />} label={t("detail.director")} value={movie.director} />
                <Credit icon={<Film className="h-3.5 w-3.5" />} label={t("detail.genre")} value={tg(movie.genre)} />
                <Credit icon={<User className="h-3.5 w-3.5" />} label={t("detail.cast")} value={movie.cast || "—"} />
              </div>

              {/* episodes — only for series */}
              {movie.type === "series" && Object.keys(episodes).length > 0 && (
                <div className="mt-6 border-t border-hairline pt-5">
                  <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-glow-soft">
                    <Tv className="h-3.5 w-3.5" />
                    Episodes
                  </div>

                  {/* season selector */}
                  <div className="mb-4 flex flex-wrap gap-2">
                    {Object.keys(episodes).map(Number).sort((a, b) => a - b).map((s) => (
                      <button
                        key={s}
                        onClick={() => setSelectedSeason(s)}
                        className={`rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                          selectedSeason === s
                            ? "bg-glow text-ink"
                            : "border border-hairline text-ash hover:border-glow/40 hover:text-bone"
                        }`}
                      >
                        {language === "es" ? "Temporada " : language === "uk" ? "Сезон " : "Season "}{s}
                      </button>
                    ))}
                  </div>

                  {/* episode list — taller on larger screens, scrollable */}
                  <div className="max-h-[50vh] space-y-1.5 overflow-y-auto rfx-scroll">
                    {(episodes[selectedSeason] || []).map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => {
                          if (ep.videoUrl) {
                            // play the episode — set videoUrl on the movie temporarily
                            closeDetail();
                            play({ ...movie, videoUrl: ep.videoUrl } as any);
                          }
                        }}
                        disabled={!ep.videoUrl}
                        className="flex w-full items-center gap-3 rounded-lg border border-hairline/60 bg-ink/40 px-3 py-2.5 text-left transition-colors hover:border-glow/30 hover:bg-ink-3 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink-3 font-mono text-xs text-glow-soft">
                          {ep.episode}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-sans text-sm text-bone">{ep.title || `Episode ${ep.episode}`}</div>
                          <div className="font-mono text-[10px] text-ash">
                            S{ep.season}E{ep.episode}
                          </div>
                        </div>
                        {ep.videoUrl && (
                          <Play className="h-4 w-4 shrink-0 fill-glow text-glow" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

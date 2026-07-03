"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  X,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useProgress, useSaveProgress } from "@/lib/hooks";
import { formatTime } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Player() {
  const movie = useApp((s) => s.playingMovie);
  const stop = useApp((s) => s.stop);
  const user = useApp((s) => s.user);
  const openAdminForm = useApp((s) => s.openAdminForm);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [playing, setPlaying] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [finished, setFinished] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const { data: progress } = useProgress();
  const saveProgress = useSaveProgress();
  const lastSave = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resumePos = movie && progress ? progress.find((p) => p.movieId === movie.id)?.position ?? 0 : 0;

  // restore position once metadata is ready
  const onLoadedMeta = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    if (resumePos > 5 && resumePos < (v.duration || Infinity) - 10) {
      v.currentTime = resumePos;
    }
  };

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration || 0));
    setCurrent(v.currentTime);
  };

  const skip = (delta: number) => seek((videoRef.current?.currentTime ?? 0) + delta);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const onVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const toggleFs = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      el.requestFullscreen?.();
    }
  };

  useEffect(() => {
    const onFs = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // controls auto-hide
  const poke = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }, []);

  // save progress (throttled to ~5s)
  const maybeSave = useCallback(
    (force = false) => {
      if (!movie) return;
      const v = videoRef.current;
      if (!v) return;
      const now = Date.now();
      if (!force && now - lastSave.current < 5000) return;
      lastSave.current = now;
      saveProgress.mutate({
        movieId: movie.id,
        position: Math.floor(v.currentTime),
        duration: Math.floor(v.duration || 0),
      });
    },
    [movie, saveProgress]
  );

  // keyboard
  useEffect(() => {
    if (!movie) return;
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          skip(-10);
          break;
        case "ArrowRight":
          skip(10);
          break;
        case "f":
          toggleFs();
          break;
        case "Escape":
          if (!document.fullscreenElement) {
            maybeSave(true);
            stop();
          }
          break;
        case "m":
          toggleMute();
          break;
      }
      poke();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [movie]);

  // save on unmount
  useEffect(() => {
    return () => {
      maybeSave(true);
    };
  }, []);

  if (!movie) return null;

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  // No licensed stream URL attached yet — this is the empty slot the curator
  // fills in from the admin dashboard. Reads as an intentional state, not a
  // crash: the film is cataloged and browseable, playback is waiting on a URL.
  const noStream = !movie.videoUrl;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-ink"
      onMouseMove={poke}
      // disable the browser context menu on the player so users can't
      // "open video in new tab" and wander off to the raw file URL —
      // playback stays inside Reflix, nothing redirects anywhere
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        // click on the backdrop (not controls) toggles play
        if (!noStream && !videoError && (e.target === e.currentTarget || e.target === videoRef.current)) {
          togglePlay();
        }
      }}
    >
      <video
        ref={videoRef}
        src={movie.videoUrl || undefined}
        autoPlay
        playsInline
        // suppress the browser's download / cast / picture-in-picture controls
        // and the right-click menu so playback is a clean, contained experience
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        disableRemotePlayback
        className="absolute inset-0 h-full w-full bg-ink"
        onClick={togglePlay}
        onContextMenu={(e) => e.preventDefault()}
        onLoadedMetadata={onLoadedMeta}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          setCurrent((e.target as HTMLVideoElement).currentTime);
          maybeSave(false);
        }}
        onEnded={() => {
          setPlaying(false);
          setFinished(true);
          maybeSave(true);
        }}
        onError={() => setVideoError(true)}
      />

      {/* no stream attached yet — the curator hasn't pasted a licensed URL */}
      {noStream && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-5 bg-ink px-6 text-center">
          {movie.backdropUrl && (
            <img
              src={movie.backdropUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-15"
            />
          )}
          <div className="relative max-w-md">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-glow-soft">
              No stream attached
            </div>
            <div className="mt-3 font-display text-4xl text-bone sm:text-5xl">
              {movie.title}
            </div>
            <p className="mx-auto mt-3 font-sans text-sm leading-relaxed text-ash">
              This title is cataloged but no video link has been attached yet.
              {user?.role === "ADMIN"
                ? " Open the Curator's Desk, edit this film, and paste your licensed stream URL into the Licensed stream URL field."
                : " The curator can attach a stream from the admin dashboard."}
            </p>
            {user?.role === "ADMIN" && (
              <button
                onClick={() => {
                  // open the admin edit form for this film, then leave the
                  // player and switch to the curator's desk so the form is visible
                  openAdminForm(movie);
                  useApp.setState({ playingMovie: null, view: "admin" });
                }}
                className="mt-6 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
              >
                Attach a stream
              </button>
            )}
            <div>
              <button
                onClick={() => stop()}
                className="mt-3 rounded-full border border-hairline px-6 py-2.5 font-sans text-sm text-bone transition-colors hover:bg-ink-3"
              >
                Back to Reflix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* stream unavailable — a URL was attached but couldn't be reached */}
      {videoError && !noStream && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-5 bg-ink px-6 text-center">
          {movie.backdropUrl && (
            <img
              src={movie.backdropUrl}
              alt=""
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
            />
          )}
          <div className="relative">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-glow-soft">
              Stream unavailable
            </div>
            <div className="mt-3 font-display text-4xl text-bone sm:text-5xl">
              {movie.title}
            </div>
            <p className="mx-auto mt-3 max-w-md font-sans text-sm leading-relaxed text-ash">
              This title's stream couldn't be reached. The catalog and player are
              fully wired — point a film at a reachable video URL to play it end
              to end.
            </p>
            <button
              onClick={() => stop()}
              className="mt-6 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink transition-all hover:bg-glow-soft"
            >
              Back to Reflix
            </button>
          </div>
        </div>
      )}

      {/* top bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-ink/90 to-transparent px-4 py-4 transition-opacity duration-300 sm:px-8",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-glow-soft">
            Now Playing
          </div>
          <div className="truncate font-display text-2xl tracking-tight text-bone sm:text-3xl">
            {movie.title}
          </div>
        </div>
        <button
          onClick={() => {
            maybeSave(true);
            stop();
          }}
          aria-label="Close player"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-hairline bg-ink/60 text-bone backdrop-blur-sm transition-colors hover:border-glow/40 hover:text-glow-soft"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* center play/pause when paused */}
      {!playing && !finished && !videoError && (
        <button
          onClick={togglePlay}
          aria-label="Play"
          className="absolute left-1/2 top-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-glow/95 text-ink shadow-[0_0_40px_-6px_var(--glow)] transition-transform hover:scale-105"
        >
          <Play className="h-8 w-8 fill-ink pl-1" />
        </button>
      )}

      {/* finished state */}
      {finished && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-ink/85 text-center">
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-glow-soft">
            End of reel
          </div>
          <div className="font-display text-4xl text-bone">{movie.title}</div>
          <div className="flex gap-3">
            <button
              onClick={() => {
                seek(0);
                setFinished(false);
                videoRef.current?.play();
              }}
              className="flex items-center gap-2 rounded-full bg-glow px-6 py-2.5 font-sans text-sm font-semibold text-ink hover:bg-glow-soft"
            >
              <RotateCcw className="h-4 w-4" />
              Watch again
            </button>
            <button
              onClick={() => stop()}
              className="rounded-full border border-hairline px-6 py-2.5 font-sans text-sm text-bone hover:bg-ink-3"
            >
              Back to Reflix
            </button>
          </div>
        </div>
      )}

      {/* bottom controls */}
      {!videoError && (
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink/95 to-transparent px-4 pb-4 pt-10 transition-opacity duration-300 sm:px-8",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}
      >
        {/* seek bar */}
        <div className="group/seek mb-3 flex items-center gap-3">
          <span className="font-mono text-[11px] tabular-nums text-bone/80">
            {formatTime(current)}
          </span>
          <div
            className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-ink-3"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              seek(((e.clientX - r.left) / r.width) * duration);
            }}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-glow/80"
              style={{ width: `${pct}%` }}
            />
            <div
              className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-glow opacity-0 shadow transition-opacity group-hover/seek:opacity-100"
              style={{ left: `calc(${pct}% - 6px)` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-ash">
            {formatTime(duration)}
          </span>
        </div>

        {/* buttons */}
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} aria-label={playing ? "Pause" : "Play"} className="text-bone hover:text-glow-soft">
            {playing ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-bone" />}
          </button>
          <button onClick={() => skip(-10)} aria-label="Back 10 seconds" className="text-bone/80 hover:text-glow-soft">
            <RotateCcw className="h-5 w-5" />
          </button>
          <button onClick={() => skip(10)} aria-label="Forward 10 seconds" className="text-bone/80 hover:text-glow-soft">
            <RotateCw className="h-5 w-5" />
          </button>

          {/* volume */}
          <div className="group/vol flex items-center gap-2">
            <button onClick={toggleMute} aria-label="Mute" className="text-bone/80 hover:text-glow-soft">
              {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => onVol(Number(e.target.value))}
              aria-label="Volume"
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-ink-3 opacity-0 transition-all group-hover/vol:w-20 group-hover/vol:opacity-100 accent-glow"
              style={{
                background: `linear-gradient(to right, var(--glow) ${(muted ? 0 : volume) * 100}%, var(--ink-3) ${(muted ? 0 : volume) * 100}%)`,
              }}
            />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={toggleFs} aria-label="Fullscreen" className="text-bone/80 hover:text-glow-soft">
              {isFs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

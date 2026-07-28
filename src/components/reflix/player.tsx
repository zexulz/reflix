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
  Captions,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { useLanguage } from "@/lib/lang-store";
import { useProgress, useSaveProgress } from "@/lib/hooks";
import { formatTime } from "@/lib/types";
import { cn } from "@/lib/utils";
import { parseSrt, findActiveCue, type SubtitleCue } from "@/lib/subtitles";

/*
  toEmbedUrl — converts common video URLs to their embeddable form so they
  work inside an <iframe>. Handles:
    - YouTube watch URLs (youtube.com/watch?v=ID) → youtube.com/embed/ID
    - YouTube short URLs (youtu.be/ID) → youtube.com/embed/ID
    - Vimeo URLs (vimeo.com/ID) → player.vimeo.com/video/ID
    - Any URL already containing "/embed/" → used as-is
    - Direct video files (.mp4, .webm, etc.) → returned as-is (native <video>)
    - Everything else → returned as-is (assumed to be a generic embed URL)
*/
function toEmbedUrl(url: string, subtitleUrl?: string | null): string {
  if (!url) return "";
  // YouTube watch URL
  const ytWatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (ytWatch) return `https://www.youtube.com/embed/${ytWatch[1]}?autoplay=1&rel=0&modestbranding=1`;
  // Vimeo
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`;

  // For embed URLs — append sub_url parameter if a subtitle is available.
  // Most embed services accept sub_url as a URL-encoded .srt/.vtt URL.
  let finalUrl = url;
  if (subtitleUrl) {
    const separator = finalUrl.includes("?") ? "&" : "?";
    finalUrl += `${separator}sub_url=${encodeURIComponent(subtitleUrl)}`;
  }
  return finalUrl;
}

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

  // ── Subtitle overlay state ──
  // For iframe embeds we can't read the video's real timecode (cross-origin),
  // so we run a manual playhead the USER syncs to the video. They hit "Sync"
  // when the video actually starts playing (after ads/loading), then nudge
  // ±5s if it drifts. This is the only reliable way to sync subtitles to a
  // third-party embed.
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<string | null>(null);
  const [subsEnabled, setSubsEnabled] = useState(true);
  const [subPlayhead, setSubPlayhead] = useState(0);      // seconds, inferred video position
  const [subOffset, setSubOffset] = useState(0);          // seconds, user correction
  const [subPanelOpen, setSubPanelOpen] = useState(false);
  const playheadRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeCueRef = useRef<string | null>(null);
  const subtitleUrl = (movie as any)?.subtitleUrl || (movie as any)?.episodeSubtitleUrl || null;

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

  // ── Fetch + parse subtitle file when a movie/episode loads ──
  // Subtitles are Ukrainian-only — only fetch when the user selected 🇺🇦
  // on the home page language gate.
  const language = useLanguage((s) => s.language);
  const subsAllowed = language === "uk";

  useEffect(() => {
    if (!subtitleUrl || !subsAllowed) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setSubtitleCues([]);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }
    let cancelled = false;
    fetch(subtitleUrl)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) {
          const cues = parseSrt(text);
          setSubtitleCues(cues);
        }
      })
      .catch(() => {
        if (!cancelled) setSubtitleCues([]);
      });
    return () => { cancelled = true; };
  }, [subtitleUrl, subsAllowed]);

  // ── For iframe embeds: run a manual playhead the user can sync ──
  // We can't read the iframe's internal timecode (cross-origin), so we count
  // seconds ourselves. The user hits "Sync" when the video actually starts
  // playing — that zeros the effective subtitle time. They can also nudge
  // ±5s or drag the offset slider to fine-tune.
  useEffect(() => {
    const isDirect = movie?.videoUrl ? /\.(mp4|webm|m4v|ogg|ogv|m3u8|mov)(\?|#|$)/i.test(movie.videoUrl) : false;
    if (!movie || isDirect || !subtitleCues.length) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    // only tick while "playing" (not paused/finished/errored)
    if (playing && !finished && !videoError) {
      tickRef.current = setInterval(() => {
        playheadRef.current += 1;
        setSubPlayhead(playheadRef.current);
      }, 1000);
    } else {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [movie, playing, finished, videoError, subtitleCues.length]);

  // ── Reset playhead when the movie changes ──
  useEffect(() => {
    playheadRef.current = 0;
    // reset is intentional on movie change; the cascading render is negligible
    /* eslint-disable react-hooks/set-state-in-effect */
    setSubPlayhead(0);
    setSubOffset(0);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [movie?.id]);

  // ── "Start subtitles" ──
  // Resets the subtitle clock to 0 so cues begin from the top. The user
  // presses this the moment the video actually starts playing (after the
  // ads/loading). The clock then ticks forward in step with the video and
  // pauses automatically when the video is paused.
  const syncSubs = useCallback(() => {
    playheadRef.current = 0;
    setSubPlayhead(0);
    setSubOffset(0);
  }, []);

  // ── Update active subtitle cue ──
  useEffect(() => {
    if (!subtitleCues.length || !subsEnabled) return;
    const isDirect = movie?.videoUrl ? /\.(mp4|webm|m4v|ogg|ogv|m3u8|mov)(\?|#|$)/i.test(movie.videoUrl) : false;
    // direct video: use the real timecode. iframe: use the synced playhead + offset.
    const time = isDirect ? current : (subPlayhead + subOffset);
    const cue = findActiveCue(subtitleCues, time);
    const cueText = cue ? cue.text : null;
    if (cueText !== activeCueRef.current) {
      activeCueRef.current = cueText;
      queueMicrotask(() => setActiveCue(cueText));
    }
  }, [current, subPlayhead, subOffset, subtitleCues, subsEnabled, movie?.videoUrl]);

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

  // Detect whether the URL is a direct video file (use native <video>) or an
  // embed URL (use <iframe> — for YouTube, Vimeo, or any embed service).
  const rawUrl = movie.videoUrl || "";
  const isDirectVideo = /\.(mp4|webm|m4v|ogg|ogv|m3u8|mov)(\?|#|$)/i.test(rawUrl);
  const embedUrl = toEmbedUrl(rawUrl, movie.subtitleUrl);

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
      {/* native <video> for direct video files (.mp4, .webm, etc.) */}
      {isDirectVideo && (
        <video
          ref={videoRef}
          src={movie.videoUrl || undefined}
          autoPlay
          playsInline
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
      )}

      {/* <iframe> for embed URLs (YouTube, Vimeo, generic embed services) */}
      {!isDirectVideo && !noStream && (
        <iframe
          src={embedUrl}
          title={movie.title}
          className="absolute inset-0 h-full w-full bg-ink"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
          referrerPolicy="origin"
          onLoad={() => setPlaying(true)}
        />
      )}

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

      {/* stream unavailable — a direct video URL was attached but couldn't be
          reached (iframes handle their own errors internally) */}
      {videoError && !noStream && isDirectVideo && (
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

      {/* ── Subtitle overlay ── renders on top of both video and iframe.
          Sits higher up (bottom-28) on iframe embeds so it clears the
          sync control bar; lower (bottom-24) on native video. */}
      {activeCue && subsEnabled && !finished && (
        <div className={cn(
          "pointer-events-none absolute inset-x-0 z-[6] flex justify-center px-4 sm:px-8",
          isDirectVideo ? "bottom-24" : "bottom-32"
        )}>
          <div className="max-w-2xl rounded-md bg-ink/85 px-4 py-2 text-center backdrop-blur-sm">
            {activeCue.split("\n").map((line, i) => (
              <p key={i} className="font-sans text-base leading-snug text-bone sm:text-lg">
                {line}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Панель керування субтитрами ── (лише для iframe-вставок)
          Оскільки ми не можемо зчитувати реальний час відтворення з iframe
          (іншоorigin), користувач запускає субтитри вручну: чекає, поки
          відео реально почне грати, потім натискає «Запустити субтитри».
          Годинник іде від 0 і призупиняється, коли відео на паузі. */}
      {!isDirectVideo && !noStream && !videoError && subtitleCues.length > 0 && !finished && (
        <div
          className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-ink/95 to-transparent px-4 pb-4 pt-10 sm:px-8"
        >
          <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-3">
            {/* Увімк/Вимк субтитри */}
            <button
              onClick={() => setSubsEnabled(!subsEnabled)}
              aria-label={subsEnabled ? "Вимкнути субтитри" : "Увімкнути субтитри"}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 font-sans text-xs font-medium transition-colors",
                subsEnabled
                  ? "border-glow/50 bg-glow/15 text-glow"
                  : "border-hairline bg-ink/60 text-bone/60 hover:text-bone"
              )}
            >
              <Captions className="h-4 w-4" />
              {subsEnabled ? "Увімк" : "Вимк"}
            </button>

            {/* Запустити субтитри — обнуляє годинник, щоб репліки почались спочатку */}
            <button
              onClick={syncSubs}
              className="flex h-9 items-center gap-1.5 rounded-full bg-glow px-4 font-sans text-xs font-semibold text-ink transition-transform hover:scale-105"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Запустити субтитри
            </button>

            {/* Коротке пояснення поруч із кнопкою */}
            <p className="max-w-xs text-center font-sans text-[11px] leading-snug text-ash sm:text-left">
              Дочекайтеся, поки відео почне відтворюватися, потім натисніть{" "}
              <span className="text-glow-soft">Запустити субтитри</span>. Вони
              призупиняються, коли ви ставите відео на паузу.
            </p>
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

      {/* center play/pause when paused — only for native video */}
      {!playing && !finished && !videoError && isDirectVideo && (
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

      {/* bottom controls — only for native video (iframes have their own) */}
      {!videoError && isDirectVideo && (
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
            {/* CC subtitle toggle — only shows if subtitles are available */}
            {subtitleCues.length > 0 && (
              <button
                onClick={() => setSubsEnabled(!subsEnabled)}
                aria-label={subsEnabled ? "Disable subtitles" : "Enable subtitles"}
                className={cn("transition-colors", subsEnabled ? "text-glow" : "text-bone/40 hover:text-bone/80")}
              >
                <Captions className="h-5 w-5" />
              </button>
            )}
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

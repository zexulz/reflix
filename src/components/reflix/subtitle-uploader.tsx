"use client";

import { useState, useRef } from "react";
import {
  Loader2,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  Languages,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useSeries, useEpisodes } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";

export function SubtitleUploader() {
  const open = useApp((s) => s.subtitleUploaderOpen);
  const setOpen = useApp((s) => s.setSubtitleUploaderOpen);
  const [files, setFiles] = useState<File[]>([]);
  const [seriesId, setSeriesId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    failed: number;
    results: { filename: string; matched: boolean; episode?: string; error?: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  // ── generation state ──
  const [tab, setTab] = useState<"upload" | "generate">("upload");
  const [openSubsKey, setOpenSubsKey] = useState("");
  const [genSeriesId, setGenSeriesId] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genProgress, setGenProgress] = useState<{
    total: number;
    completed: number;
    remaining: number;
    lastEpisode: string | null;
    log: { episode: string; status: "ok" | "skip" | "error"; note?: string }[];
  } | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const stopRef = useRef(false);

  const { data: seriesData } = useSeries();
  const seriesList = (seriesData ?? []) as any[];
  // default the generate target to The Mentalist (tmdbId 5920) when available
  const defaultSeriesId =
    genSeriesId ||
    seriesList.find((s) => s.tmdbId === 5920)?.id ||
    seriesList[0]?.id ||
    "";
  const { data: episodesData } = useEpisodes(defaultSeriesId);
  const episodes = (episodesData ?? []) as any[];

  const submit = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("seriesId", seriesId);
      for (const f of files) {
        form.append("files", f);
      }
      const res = await fetch("/api/subtitles/bulk", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Upload failed");
      }
      const data = await res.json();
      setResult(data);
      qc.invalidateQueries({ queryKey: ["movies"] });
      qc.invalidateQueries({ queryKey: ["series"] });
      qc.invalidateQueries({ queryKey: ["episodes"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Generate loop: call /api/subtitles/generate once per episode ──
  const generate = async () => {
    if (!defaultSeriesId) return;
    if (!openSubsKey.trim()) {
      setGenError("Paste your OpenSubtitles API key first.");
      return;
    }
    setGenLoading(true);
    setGenError(null);
    stopRef.current = false;
    setGenProgress({
      total: episodes.length,
      completed: episodes.filter((e) => e.subtitleUrl).length,
      remaining: episodes.filter((e) => !e.subtitleUrl).length,
      lastEpisode: null,
      log: [],
    });

    let total = episodes.length;
    let completed = episodes.filter((e) => e.subtitleUrl).length;

    // loop until all done, quota hit, or user stops
    // cap iterations at total + 5 to avoid infinite loops on persistent skips
    let safety = total + 5;
    while (!stopRef.current && safety-- > 0) {
      try {
        const res = await fetch("/api/subtitles/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            seriesId: defaultSeriesId,
            openSubsKey: openSubsKey.trim(),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setGenError(data.error || "Generation failed.");
          break;
        }

        total = data.total ?? total;
        completed = data.completed ?? completed;

        if (data.done && data.episode) {
          setGenProgress((p) => ({
            total,
            completed,
            remaining: data.remaining,
            lastEpisode: data.episode,
            log: [
              { episode: data.episode, status: "ok", note: `${data.cueCount || ""} cues` },
              ...(p?.log ?? []),
            ].slice(0, 40),
          }));
        } else if (data.skip) {
          // no English sub for this episode — log and continue
          setGenProgress((p) => ({
            total,
            completed,
            remaining: data.remaining,
            lastEpisode: data.episode,
            log: [
              { episode: data.episode, status: "skip", note: data.error },
              ...(p?.log ?? []),
            ].slice(0, 40),
          }));
          // if remaining is 0 after a skip, stop
          if (data.remaining <= 0) break;
        } else if (data.done && !data.episode) {
          // all done
          setGenProgress((p) => ({
            ...p!,
            total,
            completed,
            remaining: 0,
          }));
          break;
        } else if (data.quotaHit) {
          setGenError(data.error || "OpenSubtitles quota reached.");
          break;
        } else if (data.error) {
          setGenError(data.error);
          break;
        }
      } catch (e) {
        setGenError(e instanceof Error ? e.message : "Generation failed.");
        break;
      }
      // small breather between requests
      await new Promise((r) => setTimeout(r, 400));
    }

    setGenLoading(false);
    qc.invalidateQueries({ queryKey: ["episodes"] });
    qc.invalidateQueries({ queryKey: ["series"] });
  };

  const stopGenerate = () => {
    stopRef.current = true;
  };

  const close = () => {
    setOpen(false);
    setFiles([]);
    setResult(null);
    setError(null);
    setSeriesId("");
    setGenError(null);
    setGenProgress(null);
    setGenLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="rfx-scroll max-h-[92vh] w-[96vw] max-w-2xl overflow-y-auto rounded-xl border-hairline bg-ink-2 p-0">
        <div className="sticky top-0 z-10 border-b border-hairline bg-ink-2/95 px-6 py-4 backdrop-blur">
          <DialogTitle className="font-display text-2xl tracking-tight text-bone">
            Subtitles
          </DialogTitle>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            Upload .srt files or auto-generate Ukrainian subtitles
          </p>
        </div>

        {/* tab switch */}
        <div className="flex gap-1 px-6 pt-4">
          <button
            onClick={() => setTab("upload")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
              tab === "upload"
                ? "bg-glow text-ink"
                : "border border-hairline text-ash hover:text-bone"
            }`}
          >
            <Upload className="h-3.5 w-3.5" /> Upload files
          </button>
          <button
            onClick={() => setTab("generate")}
            className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors ${
              tab === "generate"
                ? "bg-glow text-ink"
                : "border border-hairline text-ash hover:text-bone"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate Ukrainian
          </button>
        </div>

        <div className="space-y-4 px-6 py-6">
          {tab === "upload" ? (
            <>
              <p className="font-sans text-sm leading-relaxed text-ash">
                Upload multiple .srt files at once. Files should be named like
                <span className="font-mono text-glow-soft"> 5920_S1E1.srt</span> —
                the system reads the TMDB ID, season, and episode from the
                filename and matches them automatically.
              </p>

              {/* file drop zone */}
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const dropped = Array.from(e.dataTransfer.files).filter(
                    (f) => f.name.endsWith(".srt") || f.name.endsWith(".vtt")
                  );
                  setFiles((prev) => [...prev, ...dropped]);
                }}
                className="cursor-pointer rounded-xl border-2 border-dashed border-hairline bg-ink p-8 text-center transition-colors hover:border-glow/30"
              >
                <Upload className="mx-auto h-8 w-8 text-ash" />
                <p className="mt-2 font-sans text-sm text-bone">
                  Click to select or drag .srt files here
                </p>
                <p className="mt-1 font-mono text-[10px] text-ash">
                  {files.length} file{files.length === 1 ? "" : "s"} selected
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".srt,.vtt"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const selected = Array.from(e.target.files || []);
                    setFiles((prev) => [...prev, ...selected]);
                    e.target.value = "";
                  }}
                />
              </div>

              {/* file list */}
              {files.length > 0 && (
                <div className="max-h-40 space-y-1 overflow-y-auto rfx-scroll">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border border-hairline/50 bg-ink px-3 py-1.5"
                    >
                      <FileText className="h-3.5 w-3.5 shrink-0 text-ash" />
                      <span className="truncate font-mono text-xs text-bone/80">
                        {f.name}
                      </span>
                      <button
                        onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                        className="ml-auto text-ash hover:text-bone"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* series ID (optional) */}
              <div>
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  Series ID (optional — for movie subtitles)
                </label>
                <input
                  value={seriesId}
                  onChange={(e) => setSeriesId(e.target.value)}
                  placeholder="cm..."
                  className="w-full rounded-md border border-hairline bg-ink px-3 py-2 font-mono text-xs text-bone placeholder:text-ash/50 focus:border-glow/40 focus:outline-none"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-md border border-oxblood/40 bg-oxblood/15 px-3 py-2 font-sans text-xs text-bone/90">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-oxblood" />
                  {error}
                </div>
              )}

              {result && (
                <div className="space-y-3 rounded-md border border-glow/30 bg-glow/5 p-4">
                  <div className="flex items-center gap-4 font-sans text-sm font-medium text-bone">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-glow" />
                      {result.matched} matched
                    </span>
                    {result.failed > 0 && (
                      <span className="flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4 text-oxblood" />
                        {result.failed} failed
                      </span>
                    )}
                  </div>
                  <div className="max-h-32 overflow-y-auto rfx-scroll space-y-1">
                    {result.results.map((r, i) => (
                      <div
                        key={i}
                        className={`font-sans text-xs ${
                          r.matched ? "text-bone/80" : "text-oxblood/80"
                        }`}
                      >
                        {r.matched ? "✓" : "✗"} {r.filename}
                        {r.episode ? ` → ${r.episode}` : ""}
                        {r.error ? ` (${r.error})` : ""}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={close}
                  className="text-ash hover:text-bone hover:bg-ink-3"
                >
                  Close
                </Button>
                <Button
                  disabled={loading || files.length === 0}
                  onClick={submit}
                  className="gap-2 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload {files.length} file{files.length === 1 ? "" : "s"}
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* ── Generate tab ── */}
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-glow/20 bg-glow/5 p-4">
                  <Languages className="mt-0.5 h-5 w-5 shrink-0 text-glow" />
                  <div className="font-sans text-xs leading-relaxed text-ash">
                    Auto-generates Ukrainian subtitles for every episode that&apos;s
                    missing one. The system fetches the English subtitle from
                    OpenSubtitles, translates it to Ukrainian with AI, and links it
                    to the episode automatically. One episode is processed per step
                    so you see live progress.
                  </div>
                </div>

                {/* series selector */}
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                    Series
                  </label>
                  <select
                    value={defaultSeriesId}
                    onChange={(e) => setGenSeriesId(e.target.value)}
                    className="w-full rounded-md border border-hairline bg-ink px-3 py-2 font-sans text-sm text-bone focus:border-glow/40 focus:outline-none"
                  >
                    {seriesList.length === 0 && <option value="">No series</option>}
                    {seriesList.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title} ({episodes.length > 0 && s.id === defaultSeriesId ? episodes.length : "?"} eps)
                      </option>
                    ))}
                  </select>
                </div>

                {/* OpenSubtitles key */}
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                    OpenSubtitles API key
                  </label>
                  <input
                    type="password"
                    value={openSubsKey}
                    onChange={(e) => setOpenSubsKey(e.target.value)}
                    placeholder="paste your key (kept in memory only, never saved)"
                    className="w-full rounded-md border border-hairline bg-ink px-3 py-2 font-mono text-xs text-bone placeholder:text-ash/50 focus:border-glow/40 focus:outline-none"
                  />
                  <p className="mt-1 font-sans text-[11px] text-ash/70">
                    Get a free key at{" "}
                    <a
                      href="https://www.opensubtitles.com/consumers"
                      target="_blank"
                      rel="noreferrer"
                      className="text-glow-soft underline"
                    >
                      opensubtitles.com
                    </a>
                    . Free tier: 100 downloads/day.
                  </p>
                </div>

                {/* progress */}
                {genProgress && (
                  <div className="space-y-3 rounded-md border border-hairline bg-ink p-4">
                    <div className="flex items-center justify-between font-sans text-sm">
                      <span className="font-medium text-bone">
                        {genProgress.completed} / {genProgress.total} episodes
                      </span>
                      <span className="font-mono text-[11px] text-ash">
                        {genProgress.remaining} remaining
                      </span>
                    </div>
                    {/* progress bar */}
                    <div className="h-2 overflow-hidden rounded-full bg-ink-3">
                      <div
                        className="h-full rounded-full bg-glow transition-all duration-500"
                        style={{
                          width: `${
                            genProgress.total > 0
                              ? (genProgress.completed / genProgress.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    {/* log */}
                    {genProgress.log.length > 0 && (
                      <div className="max-h-36 space-y-1 overflow-y-auto rfx-scroll">
                        {genProgress.log.map((l, i) => (
                          <div
                            key={i}
                            className={`flex items-center gap-2 font-mono text-[11px] ${
                              l.status === "ok"
                                ? "text-glow-soft"
                                : l.status === "skip"
                                ? "text-ash"
                                : "text-oxblood"
                            }`}
                          >
                            <span>
                              {l.status === "ok" ? "✓" : l.status === "skip" ? "◌" : "✗"}
                            </span>
                            <span>{l.episode}</span>
                            {l.note && <span className="text-ash/60">— {l.note}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {genError && (
                  <div className="flex items-start gap-2 rounded-md border border-oxblood/40 bg-oxblood/15 px-3 py-2 font-sans text-xs text-bone/90">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-oxblood" />
                    {genError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    onClick={close}
                    className="text-ash hover:text-bone hover:bg-ink-3"
                  >
                    Close
                  </Button>
                  {genLoading ? (
                    <Button
                      onClick={stopGenerate}
                      variant="outline"
                      className="gap-2 rounded-full border-oxblood/50 text-oxblood hover:bg-oxblood/10"
                    >
                      <Loader2 className="h-4 w-4 animate-spin" /> Stop
                    </Button>
                  ) : (
                    <Button
                      disabled={!defaultSeriesId}
                      onClick={generate}
                      className="gap-2 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
                    >
                      <Sparkles className="h-4 w-4" /> Generate
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

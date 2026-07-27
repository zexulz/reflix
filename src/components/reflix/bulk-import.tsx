"use client";

import { useState } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
import { useQueryClient } from "@tanstack/react-query";

export function BulkImport() {
  const open = useApp((s) => s.bulkImportOpen);
  const setOpen = useApp((s) => s.setBulkImportOpen);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    matched: number;
    created: number;
    episodesAdded: number;
    notFound: number[];
    malformed: number;
    updatedTitles: string[];
    createdTitles: string[];
    episodeDetails: { series: string; season: number; episode: number }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const submit = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/movies/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Import failed");
      }
      const data = await res.json();
      setResult(data);
      // refresh the movie list so the "With stream" stat updates
      qc.invalidateQueries({ queryKey: ["movies"] });
      // clear the textarea on success so private URLs don't linger
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setText("");
    setResult(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="rfx-scroll max-h-[92vh] w-[96vw] max-w-2xl overflow-y-auto rounded-xl border-hairline bg-ink-2 p-0">
        <div className="sticky top-0 z-10 border-b border-hairline bg-ink-2/95 px-6 py-4 backdrop-blur">
          <DialogTitle className="font-display text-2xl tracking-tight text-bone">
            Bulk paste stream URLs
          </DialogTitle>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            Matched by IMDb ID · URLs go straight to the database
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <p className="font-sans text-sm leading-relaxed text-ash">
            Paste your stream URLs — one per line. The system extracts the TMDB
            ID (the trailing number) from each URL and matches it to the right
            film. Works with direct video files (`.mp4`) and embed URLs (YouTube,
            Vimeo, or any embed service). The URL is stored as-is, never inspected.
          </p>

          <div className="rounded-md border border-hairline bg-ink p-3 font-mono text-[11px] leading-relaxed text-ash">
            <div className="mb-1 text-glow-soft"># movies, TV episodes, and subtitles all work</div>
            https://your-host.com/278<br />
            https://your-host.com/tv/1399/1/1<br />
            https://your-host.com/tv/1399/1/1|sub:https://subs.com/1399_1_1.srt
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={"https://your-host.com/278\nhttps://your-host.com/238\nhttps://your-host.com/155"}
            className="w-full resize-none rounded-md border border-hairline bg-ink p-3 font-mono text-xs text-bone placeholder:text-ash/40 focus:border-glow/40 focus:outline-none rfx-scroll"
            spellCheck={false}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-oxblood/40 bg-oxblood/15 px-3 py-2 font-sans text-xs text-bone/90">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-oxblood" />
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-md border border-glow/30 bg-glow/5 p-4">
              <div className="flex flex-wrap items-center gap-4 font-sans text-sm font-medium text-bone">
                {result.matched > 0 && (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4 text-glow" />
                    {result.matched} updated
                  </span>
                )}
                {result.created > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-glow-soft" />
                    {result.created} new film{result.created === 1 ? "" : "s"} added
                  </span>
                )}
                {result.episodesAdded > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Plus className="h-4 w-4 text-glow-soft" />
                    {result.episodesAdded} episode{result.episodesAdded === 1 ? "" : "s"} added
                  </span>
                )}
              </div>

              {result.updatedTitles.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-ash">
                    Updated
                  </div>
                  <div className="max-h-24 overflow-y-auto rfx-scroll space-y-1">
                    {result.updatedTitles.map((t) => (
                      <div key={t} className="font-sans text-xs text-bone/80">
                        ✓ {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.createdTitles.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-glow-soft">
                    Added to catalog
                  </div>
                  <div className="max-h-24 overflow-y-auto rfx-scroll space-y-1">
                    {result.createdTitles.map((t) => (
                      <div key={t} className="font-sans text-xs text-bone/80">
                        + {t}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.episodeDetails && result.episodeDetails.length > 0 && (
                <div>
                  <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.15em] text-glow-soft">
                    Episodes added
                  </div>
                  <div className="max-h-24 overflow-y-auto rfx-scroll space-y-1">
                    {result.episodeDetails.map((ep, i) => (
                      <div key={i} className="font-sans text-xs text-bone/80">
                        + {ep.series} — S{ep.season}E{ep.episode}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(result.notFound.length > 0 || result.malformed > 0) && (
                <div className="border-t border-hairline pt-2 font-sans text-xs text-ash">
                  {result.notFound.length > 0 && (
                    <div>
                      {result.notFound.length} TMDB ID
                      {result.notFound.length === 1 ? "" : "s"} not found on TMDB:{" "}
                      <span className="font-mono text-ash/80">
                        {result.notFound.join(", ")}
                      </span>
                    </div>
                  )}
                  {result.malformed > 0 && (
                    <div>{result.malformed} line(s) couldn't be parsed</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ash/60">
              {text.trim() ? `${text.trim().split("\n").filter((l) => l.trim() && !l.startsWith("#")).length} lines ready` : "paste your list above"}
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={close}
                className="text-ash hover:text-bone hover:bg-ink-3"
              >
                Close
              </Button>
              <Button
                type="button"
                disabled={loading || !text.trim()}
                onClick={submit}
                className="gap-2 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" /> Import URLs
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

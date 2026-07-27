"use client";

import { useState, useRef } from "react";
import { Loader2, Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApp } from "@/lib/store";
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

  const close = () => {
    setOpen(false);
    setFiles([]);
    setResult(null);
    setError(null);
    setSeriesId("");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="rfx-scroll max-h-[92vh] w-[96vw] max-w-2xl overflow-y-auto rounded-xl border-hairline bg-ink-2 p-0">
        <div className="sticky top-0 z-10 border-b border-hairline bg-ink-2/95 px-6 py-4 backdrop-blur">
          <DialogTitle className="font-display text-2xl tracking-tight text-bone">
            Bulk upload subtitles
          </DialogTitle>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
            .srt files auto-matched to episodes by filename
          </p>
        </div>

        <div className="space-y-4 px-6 py-6">
          <p className="font-sans text-sm leading-relaxed text-ash">
            Upload multiple .srt files at once. Files should be named like
            <span className="font-mono text-glow-soft"> 5920_S1E1.srt</span> —
            the system reads the TMDB ID, season, and episode from the filename
            and matches them automatically.
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
                <div key={i} className="flex items-center gap-2 rounded-md border border-hairline/50 bg-ink px-3 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-ash" />
                  <span className="truncate font-mono text-xs text-bone/80">{f.name}</span>
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
                  <div key={i} className={`font-sans text-xs ${r.matched ? "text-bone/80" : "text-oxblood/80"}`}>
                    {r.matched ? "✓" : "✗"} {r.filename}
                    {r.episode ? ` → ${r.episode}` : ""}
                    {r.error ? ` (${r.error})` : ""}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={close} className="text-ash hover:text-bone hover:bg-ink-3">
              Close
            </Button>
            <Button
              disabled={loading || files.length === 0}
              onClick={submit}
              className="gap-2 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload {files.length} file{files.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Star, Film, Loader2, Lock, Upload, Captions, Search, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TmdbSearch } from "./tmdb-search";
import { BulkImport } from "./bulk-import";
import { SubtitleUploader } from "./subtitle-uploader";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MovieForm } from "./movie-form";
import { useApp } from "@/lib/store";
import { useAllMovies, useDeleteMovie, useMe } from "@/lib/hooks";
import { formatRuntime, type Movie } from "@/lib/types";

export function AdminDashboard() {
  const { data: user } = useMe();
  const setView = useApp((s) => s.setView);
  const openAuth = useApp((s) => s.openAuth);
  const openAdminForm = useApp((s) => s.openAdminForm);
  const setBulkImportOpen = useApp((s) => s.setBulkImportOpen);
  const setSubtitleUploaderOpen = useApp((s) => s.setSubtitleUploaderOpen);
  const { data: movies, isLoading } = useAllMovies();
  const del = useDeleteMovie();

  const [deleteTarget, setDeleteTarget] = useState<Movie | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const list = movies ?? [];
  // client-side filter + paginate so 5,900 rows don't freeze the page.
  // Hooks must run before any early return.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (m) =>
        m.title.toLowerCase().includes(q) ||
        (m.director || "").toLowerCase().includes(q) ||
        (m.genre || "").toLowerCase().includes(q) ||
        String(m.year).includes(q)
    );
  }, [list, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (!user) {
    return (
      <Gate
        title="Sign in required"
        body="The Curator's Desk is for members only. Sign in to continue."
        actionLabel="Sign in"
        onAction={() => openAuth("signin")}
      />
    );
  }

  if (user.role !== "ADMIN") {
    return (
      <Gate
        title="Curator access required"
        body={`Signed in as ${user.email}. This desk is reserved for curators.`}
        actionLabel="Back to Reflix"
        onAction={() => setView("browse")}
      />
    );
  }

  const featuredCount = list.filter((m) => m.featured).length;
  const newCount = list.filter((m) => m.isNew).length;

  const openNew = () => openAdminForm(null);
  const openEdit = (m: Movie) => openAdminForm(m);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    del.mutate(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-20 pt-24 sm:px-8">
      {/* header */}
      <div className="flex flex-col gap-6 border-b border-hairline pb-8 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-glow-soft">
            <Film className="h-3.5 w-3.5" />
            Curator's Desk
          </div>
          <h1 className="mt-2 font-display text-5xl tracking-tight text-bone sm:text-6xl">
            The catalog
          </h1>
          <p className="mt-2 max-w-lg font-sans text-sm text-ash">
            Add, edit, and program the films that appear on Reflix. Flags decide
            which reel a title lands in.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            onClick={() => setSubtitleUploaderOpen(true)}
            variant="outline"
            className="gap-2 rounded-full border-hairline bg-ink-2 text-bone hover:bg-ink-3 hover:text-glow-soft"
          >
            <Captions className="h-4 w-4" />
            Upload subtitles
          </Button>
          <Button
            onClick={() => setBulkImportOpen(true)}
            variant="outline"
            className="gap-2 rounded-full border-hairline bg-ink-2 text-bone hover:bg-ink-3 hover:text-glow-soft"
          >
            <Upload className="h-4 w-4" />
            Bulk paste URLs
          </Button>
          <Button
            onClick={openNew}
            className="gap-2 rounded-full bg-glow px-5 text-ink hover:bg-glow-soft"
          >
            <Plus className="h-4 w-4" />
            Add manually
          </Button>
        </div>
      </div>

      {/* TMDB search — admin-only quick-add */}
      <div className="mt-6">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
          Quick-add from TMDB
        </div>
        <TmdbSearch />
      </div>

      {/* stats */}
      <div className="mt-6 grid grid-cols-4 gap-3 sm:max-w-lg">
        <Stat label="Films" value={list.length} />
        <Stat label="Featured" value={featuredCount} />
        <Stat label="New" value={newCount} />
        <Stat label="With stream" value={list.filter((m) => m.videoUrl).length} />
      </div>

      {/* search + pagination bar */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ash" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(0); }}
            placeholder="Search title, director, genre, year…"
            className="w-full rounded-full border border-hairline bg-ink-2 py-2 pl-9 pr-3 font-sans text-sm text-bone placeholder:text-ash/60 focus:border-glow/40 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-ash">
          <span>
            {filtered.length === 0
              ? "0 results"
              : `Showing ${safePage * PAGE_SIZE + 1}–${Math.min(
                  (safePage + 1) * PAGE_SIZE,
                  filtered.length
                )} of ${filtered.length}`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              aria-label="Previous page"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline text-ash transition-colors hover:text-bone disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="tabular-nums">{safePage + 1} / {pageCount}</span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              aria-label="Next page"
              className="flex h-7 w-7 items-center justify-center rounded-md border border-hairline text-ash transition-colors hover:text-bone disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* table */}
      <div className="mt-3 overflow-hidden rounded-xl border border-hairline">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-ash">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
          </div>
        ) : list.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-sans text-sm text-ash">
              No films yet. Add your first title to light the marquee.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-sans text-sm text-ash">
              No films match “{query}”. Try a different search.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rfx-scroll">
            <table className="w-full min-w-[680px] text-left">
              <thead>
                <tr className="border-b border-hairline bg-ink-2/60 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
                  <th className="px-4 py-3 font-normal">Film</th>
                  <th className="px-4 py-3 font-normal">Year</th>
                  <th className="px-4 py-3 font-normal">Runtime</th>
                  <th className="px-4 py-3 font-normal">Genre</th>
                  <th className="px-4 py-3 font-normal">Rating</th>
                  <th className="px-4 py-3 font-normal">Flags</th>
                  <th className="px-4 py-3 text-right font-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-hairline/60 transition-colors last:border-0 hover:bg-ink-2/50"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded border border-hairline bg-ink">
                          {m.posterUrl ? (
                            <Image
                              src={m.posterUrl}
                              alt=""
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Film className="h-4 w-4 text-hairline" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-sans text-sm font-medium text-bone">
                            {m.title}
                          </div>
                          <div className="truncate font-mono text-[10px] text-ash">
                            {m.director || "—"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-bone/70">{m.year}</td>
                    <td className="px-4 py-3 font-mono text-xs text-bone/70">
                      {formatRuntime(m.duration)}
                    </td>
                    <td className="px-4 py-3 font-sans text-xs text-bone/70">{m.genre}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-mono text-xs text-bone/80">
                        <Star className="h-3 w-3 fill-glow text-glow" />
                        {m.rating.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {m.featured && <FlagBadge>Featured</FlagBadge>}
                        {m.isNew && <FlagBadge tone="glow">New</FlagBadge>}
                        {m.isOriginal && <FlagBadge>Original</FlagBadge>}
                        {m.isEditorsPick && <FlagBadge>Pick</FlagBadge>}
                        {!m.featured && !m.isNew && !m.isOriginal && !m.isEditorsPick && (
                          <span className="font-mono text-[10px] text-ash/50">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(m)}
                          aria-label={`Edit ${m.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ash transition-colors hover:bg-ink-3 hover:text-glow-soft"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          aria-label={`Delete ${m.title}`}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-ash transition-colors hover:bg-oxblood/20 hover:text-bone"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <MovieForm />
      <BulkImport />
      <SubtitleUploader />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="border-hairline bg-ink-2 text-bone">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl text-bone">
              Remove “{deleteTarget?.title}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-ash">
              This takes the film off Reflix immediately. The action can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-hairline bg-ink text-bone hover:bg-ink-3">
              Keep it
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-oxblood text-bone hover:bg-oxblood/80"
            >
              {del.isPending ? "Removing…" : "Remove film"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-hairline bg-ink-2 px-4 py-3">
      <div className="font-display text-3xl text-glow-soft">{value}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.2em] text-ash">
        {label}
      </div>
    </div>
  );
}

function FlagBadge({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "glow";
}) {
  return (
    <Badge
      variant="outline"
      className={
        tone === "glow"
          ? "border-glow/40 bg-glow/10 text-glow-soft"
          : "border-hairline bg-ink text-ash"
      }
    >
      {children}
    </Badge>
  );
}

function Gate({
  title,
  body,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 pb-20 pt-32 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-ink-2">
        <Lock className="h-6 w-6 text-glow-soft" />
      </div>
      <h1 className="mt-5 font-display text-4xl text-bone">{title}</h1>
      <p className="mt-2 font-sans text-sm text-ash">{body}</p>
      <Button
        onClick={onAction}
        className="mt-6 rounded-full bg-glow px-6 text-ink hover:bg-glow-soft"
      >
        {actionLabel}
      </Button>
    </div>
  );
}

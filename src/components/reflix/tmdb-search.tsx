"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Plus, Loader2, Check, Film } from "lucide-react";
import { useTmdbSearch, useTmdbImport } from "@/lib/hooks";
import { cn } from "@/lib/utils";

const IMG = "https://image.tmdb.org/t/p/w185";

export function TmdbSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useTmdbSearch(query, open);
  const importMovie = useTmdbImport();

  // close dropdown when clicking outside
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleImport = async (tmdbId: number) => {
    setError(null);
    try {
      const res = await importMovie.mutateAsync(tmdbId);
      setImportedIds((prev) => new Set(prev).add(tmdbId));
      // keep the dropdown open so you can import several in a row
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    }
  };

  const results = search.data ?? [];

  return (
    <div ref={containerRef} className="relative">
      {/* search input */}
      <div className="flex items-center gap-2.5 rounded-full border border-hairline bg-ink px-4 py-2.5 transition-colors focus-within:border-glow/50">
        <Search className="h-4 w-4 shrink-0 text-ash" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setError(null);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search TMDB to add a film — title, e.g. “The Matrix”…"
          className="w-full bg-transparent font-sans text-sm text-bone placeholder:text-ash/60 focus:outline-none"
        />
        {search.isFetching && (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-glow-soft" />
        )}
      </div>

      {/* results dropdown */}
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[460px] overflow-y-auto rounded-xl border border-hairline bg-ink-2 shadow-2xl rfx-scroll">
          {search.isError ? (
            <div className="p-4 font-sans text-sm text-oxblood">
              Search failed. Check your TMDB_API_KEY.
            </div>
          ) : !search.isFetching && results.length === 0 ? (
            <div className="p-4 font-sans text-sm text-ash">
              No films found for “{query}”.
            </div>
          ) : results.length === 0 && search.isFetching ? (
            <div className="flex items-center gap-2 p-4 font-sans text-sm text-ash">
              <Loader2 className="h-4 w-4 animate-spin" /> Searching TMDB…
            </div>
          ) : (
            results.map((r) => {
              const imported = importedIds.has(r.tmdbId);
              return (
                <div
                  key={r.tmdbId}
                  className="flex items-center gap-3 border-b border-hairline/50 p-3 last:border-0 hover:bg-ink-3/50"
                >
                  {/* poster thumb */}
                  <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-ink-3">
                    {r.posterPath ? (
                      <img
                        src={`${IMG}${r.posterPath}`}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Film className="h-4 w-4 text-hairline" />
                      </div>
                    )}
                  </div>

                  {/* title + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-sans text-sm font-medium text-bone">
                      {r.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-ash">
                      {r.year && <span>{r.year}</span>}
                      {r.rating > 0 && (
                        <>
                          <span className="text-hairline">·</span>
                          <span className="text-glow-soft">★ {r.rating.toFixed(1)}</span>
                        </>
                      )}
                    </div>
                    {r.overview && (
                      <div className="mt-1 line-clamp-1 font-sans text-xs text-ash/70">
                        {r.overview}
                      </div>
                    )}
                  </div>

                  {/* import button */}
                  <button
                    onClick={() => handleImport(r.tmdbId)}
                    disabled={imported || importMovie.isPending}
                    className={cn(
                      "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-sans text-xs font-medium transition-all",
                      imported
                        ? "bg-glow/15 text-glow-soft"
                        : "bg-glow text-ink hover:bg-glow-soft disabled:opacity-60"
                    )}
                  >
                    {imported ? (
                      <>
                        <Check className="h-3.5 w-3.5" /> Added
                      </>
                    ) : importMovie.isPending && importMovie.variables === r.tmdbId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" /> Add
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}

          {error && (
            <div className="border-t border-hairline p-3 font-sans text-xs text-oxblood">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

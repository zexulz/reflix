"use client";

import { useApp } from "@/lib/store";

export function Footer() {
  const openAuth = useApp((s) => s.openAuth);
  return (
    <footer className="mt-auto border-t border-hairline bg-ink">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* brand */}
          <div className="max-w-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex flex-col gap-[3px]" aria-hidden>
                <span className="h-[3px] w-5 rounded-[1px] bg-glow" />
                <span className="h-[3px] w-5 rounded-[1px] bg-glow/55" />
              </span>
              <span className="font-display text-xl tracking-[0.16em] text-bone">REFLIX</span>
            </div>
            <p className="mt-3 font-sans text-sm leading-relaxed text-ash">
              A midnight screening, every night. A curated streaming home for cinema,
              lit like a projection booth.
            </p>
          </div>

          {/* demo credentials */}
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-2">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                Curator access
              </div>
              <button
                onClick={() => openAuth("signin")}
                className="mt-2 block font-mono text-xs text-bone/80 transition-colors hover:text-glow-soft"
              >
                admin@reflix.com
                <br />
                <span className="text-ash">reflix-admin</span>
              </button>
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ash">
                Member access
              </div>
              <button
                onClick={() => openAuth("signin")}
                className="mt-2 block font-mono text-xs text-bone/80 transition-colors hover:text-glow-soft"
              >
                viewer@reflix.com
                <br />
                <span className="text-ash">reflix-viewer</span>
              </button>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-ash sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Reflix — Reel 00 / Colophon</span>
          <span className="text-ash/70">
            Built on Next.js · Prisma · Data layer ready for Supabase
          </span>
        </div>
      </div>
    </footer>
  );
}

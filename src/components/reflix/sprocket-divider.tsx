"use client";

import { cn } from "@/lib/utils";

/**
 * SprocketDivider — the signature structural element of Reflix.
 * A perforated film-strip hairline on each side of a reel label, with a
 * pulsing projector-bulb. The REEL numbering encodes the curated order of
 * rows (a real sequence), so the numbering is truthful, not decorative.
 */
export function SprocketDivider({
  reel,
  title,
  className,
}: {
  reel?: number;
  title: string;
  className?: string;
}) {
  const perf =
    "bg-[repeating-linear-gradient(90deg,var(--ink-3)_0_9px,transparent_9px_17px)]";
  return (
    <div className={cn("relative flex items-center gap-4 py-1", className)}>
      <div className={cn("h-[5px] flex-1 rounded-[1px]", perf)} aria-hidden />
      <div className="flex shrink-0 items-center gap-2.5 px-1">
        <span className="bulb h-1.5 w-1.5 rounded-[1px] bg-glow" />
        <span className="font-mono text-[11px] uppercase tracking-[0.34em] text-ash">
          {reel != null && (
            <>
              <span className="text-bone/55">
                REEL {String(reel).padStart(2, "0")}
              </span>
              <span className="mx-2 text-hairline">/</span>
            </>
          )}
          <span className="text-bone/90">{title}</span>
        </span>
      </div>
      <div className={cn("h-[5px] flex-1 rounded-[1px]", perf)} aria-hidden />
    </div>
  );
}

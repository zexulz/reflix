"use client";

import { useRef, useState, useEffect, type ReactNode } from "react";

/*
  LazyReel — wraps a Reel and only renders its movie cards when the reel
  scrolls near the viewport. Before that, it renders just the sprocket
  divider + a placeholder of the same height, so the page layout is stable
  and the scrollbar doesn't jump.

  This is the single biggest performance optimization for a catalog with
  thousands of films: instead of rendering 50+ reels × 20+ cards each
  = 1000+ DOM nodes upfront, only the visible reels render.
*/
export function LazyReel({
  children,
  placeholderHeight = 320,
  rootMargin = "200px",
  fallback,
}: {
  children: ReactNode;
  placeholderHeight?: number;
  rootMargin?: string;
  fallback?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // if IntersectionObserver isn't available (old browser), render immediately
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined"
  );

  useEffect(() => {
    if (visible) return; // already visible, no need to observe

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect(); // once visible, stay rendered — don't re-hide
        }
      },
      { rootMargin: `${rootMargin} 0px` }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin, visible]);

  if (visible) {
    return <>{children}</>;
  }

  return (
    <div ref={ref} style={{ minHeight: placeholderHeight }}>
      {fallback}
    </div>
  );
}

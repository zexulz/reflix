"use client";

import { useEffect, useState } from "react";
import { Search, X, LayoutDashboard, LogOut, ListVideo, ChevronLeft } from "lucide-react";
import { useApp } from "@/lib/store";
import { useMe, useSignOut } from "@/lib/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/lang-store";

const NAV_KEYS = [
  { key: "nav.home", id: "top" },
  { key: "nav.trending", id: "reel-trending" },
  { key: "nav.action", id: "reel-genre-action" },
  { key: "nav.comedy", id: "reel-genre-comedy" },
  { key: "nav.horror", id: "reel-genre-horror" },
  { key: "nav.marvel", id: "collection-marvel" },
  { key: "reel.series", id: "reel-series" },
  { key: "nav.browseAll", id: "reel-catalog" },
  { key: "nav.myList", id: "reel-mylist" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const view = useApp((s) => s.view);
  const setView = useApp((s) => s.setView);
  const setSearch = useApp((s) => s.setSearch);
  const search = useApp((s) => s.search);
  const openAuth = useApp((s) => s.openAuth);
  const { data: user } = useMe();
  const signOut = useSignOut();
  const t = useLanguage((s) => s.t);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const go = (id: string) => {
    setSearch("");
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // The target reel might be inside a LazyReel that hasn't rendered yet.
    // Try to find it; if not found, scroll down progressively to trigger
    // lazy rendering, then try again.
    const tryScroll = (attempts: number) => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (attempts > 0) {
        // scroll down a chunk to trigger lazy reels to render
        window.scrollBy({ top: 600, behavior: "auto" });
        setTimeout(() => tryScroll(attempts - 1), 200);
      }
    };
    tryScroll(10);
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.email[0]?.toUpperCase() ?? "·";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-all duration-500",
        scrolled || view === "admin"
          ? "glass border-b border-hairline/60"
          : "bg-gradient-to-b from-ink/90 via-ink/40 to-transparent"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-8">
        {/* wordmark */}
        <button
          onClick={() => {
            setView("browse");
            setSearch("");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Reflix home"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[3px] w-5 rounded-[1px] bg-glow" />
            <span className="h-[3px] w-5 rounded-[1px] bg-glow/55" />
          </span>
          <span className="font-display text-2xl tracking-[0.16em] text-bone">REFLIX</span>
        </button>

        {/* admin: back button instead of nav */}
        {view === "admin" ? (
          <button
            onClick={() => setView("browse")}
            className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ash transition-colors hover:text-glow"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            {t("admin.backToReflix")}
          </button>
        ) : (
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_KEYS.map((n) => (
              <button
                key={n.id}
                onClick={() => go(n.id)}
                className="rounded-md px-3 py-1.5 font-sans text-sm text-bone/75 transition-colors hover:bg-ink-3 hover:text-bone"
              >
                {t(n.key)}
              </button>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* search */}
          {searchOpen || search ? (
            <div className="flex items-center gap-2 rounded-full border border-hairline bg-ink/80 px-3 py-1.5 backdrop-blur-sm">
              <Search className="h-4 w-4 text-ash" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("nav.search")}
                className="w-36 bg-transparent font-sans text-sm text-bone placeholder:text-ash focus:outline-none sm:w-56"
              />
              <button
                onClick={() => {
                  setSearch("");
                  setSearchOpen(false);
                }}
                aria-label="Close search"
              >
                <X className="h-4 w-4 text-ash hover:text-bone" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-bone/80 transition-colors hover:bg-ink-3 hover:text-bone"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
          )}

          {/* auth / profile */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-ink-3 font-mono text-xs font-semibold text-bone transition-colors hover:border-glow/40"
                  aria-label="Account menu"
                >
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 border-hairline bg-ink-2 text-bone"
              >
                <DropdownMenuLabel className="font-sans text-bone">
                  <div className="truncate">{user.name || "Member"}</div>
                  <div className="truncate font-mono text-[11px] font-normal text-ash">
                    {user.email}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-hairline" />
                <DropdownMenuItem
                  onClick={() => {
                    setView("browse");
                    go("reel-mylist");
                  }}
                  className="cursor-pointer focus:bg-ink-3"
                >
                  <ListVideo className="mr-2 h-4 w-4" />
                  {t("nav.myList")}
                </DropdownMenuItem>
                {user.role === "ADMIN" && (
                  <DropdownMenuItem
                    onClick={() => setView("admin")}
                    className="cursor-pointer focus:bg-ink-3"
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    {t("admin.curatorsDesk")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-hairline" />
                <DropdownMenuItem
                  onClick={() => signOut.mutate()}
                  className="cursor-pointer text-bone/80 focus:bg-ink-3"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("nav.signOut")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => openAuth("signin")}
              className="rounded-full border border-hairline bg-ink/40 px-4 py-1.5 font-sans text-sm text-bone backdrop-blur-sm transition-all hover:border-glow/40 hover:text-glow-soft"
            >
              {t("nav.signIn")}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

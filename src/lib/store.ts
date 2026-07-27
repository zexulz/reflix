"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Movie, SessionUser } from "@/lib/types";

export type View = "browse" | "watch" | "admin";

type State = {
  user: SessionUser | null;
  setUser: (u: SessionUser | null) => void;

  view: View;
  setView: (v: View) => void;

  // movie detail modal
  detailMovie: Movie | null;
  openDetail: (m: Movie) => void;
  closeDetail: () => void;

  // player
  playingMovie: Movie | null;
  play: (m: Movie) => void;
  stop: () => void;

  // auth modal
  authOpen: boolean;
  authMode: "signin" | "signup";
  openAuth: (mode?: "signin" | "signup") => void;
  closeAuth: () => void;

  // search
  search: string;
  setSearch: (q: string) => void;

  // my list (persisted locally)
  myList: string[];
  toggleList: (id: string) => void;
  inList: (id: string) => boolean;

  // the view to return to after leaving admin
  returnView: View;
  setReturnView: (v: View) => void;

  // admin movie form — single source of truth so it can be opened from
  // anywhere (the table's Edit button, the detail modal's Edit, etc.)
  adminFormOpen: boolean;
  adminEditing: Movie | null;
  openAdminForm: (m: Movie | null) => void;
  closeAdminForm: () => void;

  // bulk-import modal — paste IMDb ID + URL pairs
  bulkImportOpen: boolean;
  setBulkImportOpen: (o: boolean) => void;

  // subtitle bulk uploader
  subtitleUploaderOpen: boolean;
  setSubtitleUploaderOpen: (o: boolean) => void;
};

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (u) => set({ user: u }),

      view: "browse",
      setView: (v) => set({ view: v }),

      detailMovie: null,
      openDetail: (m) => set({ detailMovie: m }),
      closeDetail: () => set({ detailMovie: null }),

      playingMovie: null,
      play: (m) => {
        const cur = get().view;
        set({
          playingMovie: m,
          view: "watch",
          returnView: cur === "watch" ? get().returnView : cur,
        });
      },
      stop: () => set({ view: get().returnView || "browse", playingMovie: null }),

      authOpen: false,
      authMode: "signin",
      openAuth: (mode = "signin") => set({ authOpen: true, authMode: mode }),
      closeAuth: () => set({ authOpen: false }),

      search: "",
      setSearch: (q) => set({ search: q }),

      myList: [],
      toggleList: (id) => {
        const cur = get().myList;
        set({
          myList: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
        });
      },
      inList: (id) => get().myList.includes(id),

      returnView: "browse",
      setReturnView: (v) => set({ returnView: v }),

      adminFormOpen: false,
      adminEditing: null,
      openAdminForm: (m) => set({ adminFormOpen: true, adminEditing: m }),
      closeAdminForm: () => set({ adminFormOpen: false, adminEditing: null }),

      bulkImportOpen: false,
      setBulkImportOpen: (o) => set({ bulkImportOpen: o }),

      subtitleUploaderOpen: false,
      setSubtitleUploaderOpen: (o) => set({ subtitleUploaderOpen: o }),
    }),
    {
      name: "reflix-store",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ myList: s.myList }),
    }
  )
);

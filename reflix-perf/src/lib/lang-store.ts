"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { type Language, translate, translateGenre } from "@/lib/i18n";

type LanguageState = {
  language: Language | null; // null = not yet selected (shows the gate)
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  tg: (genre: string) => string; // translate genre name
};

export const useLanguage = create<LanguageState>()(
  persist(
    (set, get) => ({
      language: null,
      setLanguage: (lang) => set({ language: lang }),
      t: (key: string) => {
        const lang = get().language ?? "en";
        return translate(lang, key);
      },
      tg: (genre: string) => {
        const lang = get().language ?? "en";
        return translateGenre(lang, genre);
      },
    }),
    {
      name: "reflix-language",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

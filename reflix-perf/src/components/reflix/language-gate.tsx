"use client";

import { motion } from "framer-motion";
import { useLanguage } from "@/lib/lang-store";
import { LANGUAGES } from "@/lib/i18n";
import { useState } from "react";

export function LanguageGate({ children }: { children: React.ReactNode }) {
  const language = useLanguage((s) => s.language);
  const setLanguage = useLanguage((s) => s.setLanguage);
  const [selected, setSelected] = useState<Language | null>(null);

  // once a language is chosen, render the app
  if (language) {
    return <>{children}</>;
  }

  const handleContinue = () => {
    if (selected) {
      setLanguage(selected);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6">
      {/* ambient glow */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/2 top-1/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-glow/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center"
      >
        {/* logo */}
        <div className="mb-8 flex items-center gap-3">
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[4px] w-7 rounded-[1px] bg-glow" />
            <span className="h-[4px] w-7 rounded-[1px] bg-glow/55" />
          </span>
          <span className="font-display text-4xl tracking-[0.16em] text-bone">REFLIX</span>
        </div>

        <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
          {selected === "es" ? "Bienvenido a Reflix" : selected === "uk" ? "Ласкаво просимо до Reflix" : "Welcome to Reflix"}
        </h1>
        <p className="mt-3 font-sans text-base text-ash">
          {selected === "es" ? "Elige tu idioma" : selected === "uk" ? "Оберіть вашу мову" : "Choose your language"}
        </p>

        {/* language options */}
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelected(lang.code)}
              className={`flex items-center gap-3 rounded-2xl border px-8 py-5 transition-all duration-300 ${
                selected === lang.code
                  ? "border-glow/60 bg-glow/10 shadow-[0_0_30px_-8px_var(--glow)]"
                  : "border-hairline bg-ink-2 hover:border-bone/20 hover:bg-ink-3"
              }`}
            >
              <span className="text-3xl">{lang.flag}</span>
              <span className={`font-sans text-lg font-medium ${selected === lang.code ? "text-glow-soft" : "text-bone"}`}>
                {lang.label}
              </span>
            </button>
          ))}
        </div>

        {/* continue button */}
        <motion.button
          initial={false}
          animate={{ opacity: selected ? 1 : 0.4 }}
          disabled={!selected}
          onClick={handleContinue}
          className="mt-10 rounded-full bg-glow px-10 py-3.5 font-sans text-base font-semibold text-ink transition-all duration-300 hover:bg-glow-soft hover:shadow-[0_0_40px_-6px_var(--glow)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {selected === "es" ? "Continuar" : selected === "uk" ? "Продовжити" : "Continue"}
        </motion.button>
      </motion.div>
    </div>
  );
}

import type { Language } from "@/lib/i18n";

"use client";

import { useEffect, useRef, useState } from "react";
import {
  LOCALES,
  getStoredLocale,
  setStoredLocale,
} from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type LanguageSelectorProps = {
  /** Controlled locale. When omitted, the selector manages its own state from localStorage. */
  value?: Locale;
  onChange?: (locale: Locale) => void;
};

/**
 * Language dropdown (English, Deutsch, Français, Italiano).
 * Persists the choice in localStorage and updates document.documentElement.lang.
 */
export default function LanguageSelector({ value, onChange }: LanguageSelectorProps) {
  const [internalLocale, setInternalLocale] = useState<Locale>("en");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const locale = value ?? internalLocale;

  useEffect(() => {
    if (value === undefined) {
      setInternalLocale(getStoredLocale());
    }
  }, [value]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  const select = (next: Locale) => {
    if (value === undefined) setInternalLocale(next);
    setStoredLocale(next);
    onChange?.(next);
    setOpen(false);
  };

  const current = LOCALES.find((entry) => entry.code === locale) ?? LOCALES[0];

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Choose language"
        className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true">🌐</span>
          <span>{current.nativeLabel}</span>
        </span>
        <span aria-hidden="true" className="text-xs">▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label="Language"
          className="absolute bottom-full left-0 mb-2 w-full overflow-hidden rounded-lg border border-slate-700 bg-navy-900 py-1 shadow-xl"
        >
          {LOCALES.map((entry) => (
            <li key={entry.code} role="option" aria-selected={entry.code === locale}>
              <button
                type="button"
                onClick={() => select(entry.code)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 ${
                  entry.code === locale ? "font-semibold text-white" : "text-slate-300"
                }`}
              >
                <span>{entry.nativeLabel}</span>
                {entry.code === locale && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

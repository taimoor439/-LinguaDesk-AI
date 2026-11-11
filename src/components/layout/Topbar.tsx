"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { getStoredLocale, t } from "@/lib/i18n";
import type { Locale } from "@/lib/i18n";

export type TopbarProps = {
  title: string;
  userEmail?: string;
  /** Opens the mobile sidebar. */
  onMenuClick?: () => void;
};

function getInitials(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || email[0]?.toUpperCase() || "?";
}

/**
 * Dashboard top bar: mobile menu button, page title, inbox search,
 * and a user menu with sign-out via the shared Supabase browser client
 * (src/lib/supabase/client, owned by another agent).
 */
export default function Topbar({ title, userEmail, onMenuClick }: TopbarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [locale, setLocale] = useState<Locale>("en");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
    const onLocaleChange = (event: Event) => {
      setLocale((event as CustomEvent<Locale>).detail);
    };
    window.addEventListener("linguadesk:locale-change", onLocaleChange);
    return () => window.removeEventListener("linguadesk:locale-change", onLocaleChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/dashboard/inbox?q=${encodeURIComponent(trimmed)}` : "/dashboard/inbox");
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Even if sign-out fails, leave the dashboard — the session is
      // server-managed and middleware will redirect if still valid.
    } finally {
      router.push("/login");
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open menu"
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold text-navy-900">{title}</h1>

        <form onSubmit={handleSearchSubmit} role="search" className="hidden sm:block">
          <label htmlFor="topbar-search" className="sr-only">
            {t(locale, "search")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <circle cx="11" cy="11" r="7" />
                <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              id="topbar-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t(locale, "search")}
              className="w-56 rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 lg:w-72"
            />
          </div>
        </form>

        {userEmail && (
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`Account: ${userEmail}`}
              className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white"
                aria-hidden="true"
              >
                {getInitials(userEmail)}
              </span>
            </button>
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
              >
                <p className="truncate px-4 py-2 text-sm text-slate-600">{userEmail}</p>
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-500 disabled:opacity-60"
                >
                  {signingOut ? "Signing out…" : t(locale, "logout")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import LanguageSelector from "./LanguageSelector";
import { DICTIONARIES, getStoredLocale } from "@/lib/i18n";
import type { DictionaryKey, Locale } from "@/lib/i18n";

export type SidebarWorkspace = {
  id: string;
  name: string;
};

export type SidebarProps = {
  workspaces: SidebarWorkspace[];
  currentId?: string;
  onSwitch?: (workspaceId: string) => void;
  /** Called when the user picks "Create workspace". Rendered only when provided. */
  onCreateWorkspace?: () => void;
  /** Mobile drawer state, managed by DashboardShell. */
  open?: boolean;
  onClose?: () => void;
};

type NavEntry = {
  key: DictionaryKey;
  href: string;
  icon: ReactNode;
};

const NAV: NavEntry[] = [
  {
    key: "overview",
    href: "/dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" />
      </svg>
    ),
  },
  {
    key: "inbox",
    href: "/dashboard/inbox",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h5l2 3h4l2-3h5M3 13V6a2 2 0 012-2h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    key: "liveChat",
    href: "/dashboard/live-chat",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 01-13.2 8L3 21l1.1-4.6A9 9 0 1121 12z" />
      </svg>
    ),
  },
  {
    key: "email",
    href: "/dashboard/email",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
      </svg>
    ),
  },
  {
    key: "contacts",
    href: "/dashboard/contacts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="9" cy="8" r="3.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 20c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5M16 8.5a3 3 0 100-6M17.5 15.5c2 .6 3.5 2 4 4.5" />
      </svg>
    ),
  },
  {
    key: "aiAssistant",
    href: "/dashboard/ai-assistant",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2zM19 15l.9 2.6L22.5 18.5l-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" />
      </svg>
    ),
  },
  {
    key: "knowledgeBase",
    href: "/dashboard/knowledge-base",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V6a2 2 0 012-2h13v13H6a2 2 0 00-2 2zm0 0a2 2 0 002 2h13" />
      </svg>
    ),
  },
  {
    key: "savedReplies",
    href: "/dashboard/saved-replies",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3h14v18l-7-4-7 4V3z" />
      </svg>
    ),
  },
  {
    key: "team",
    href: "/dashboard/team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="8" cy="9" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 19c.7-2.8 2.9-4.5 5.5-4.5s4.8 1.7 5.5 4.5M16 5.5a3 3 0 010 7M17.5 14.7c1.9.6 3.3 2 3.9 4.3" />
      </svg>
    ),
  },
  {
    key: "analytics",
    href: "/dashboard/analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
      </svg>
    ),
  },
  {
    key: "settings",
    href: "/dashboard/settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2.1-1.2L14 3h-4l-.5 2.7a7 7 0 00-2.1 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005 12a7 7 0 00.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002.1 1.2L10 21h4l.5-2.7a7 7 0 002.1-1.2l2.3 1 2-3.4-2-1.5A7 7 0 0019 12z" />
      </svg>
    ),
  },
];

export default function Sidebar({
  workspaces,
  currentId,
  onSwitch,
  onCreateWorkspace,
  open = false,
  onClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");

  useEffect(() => {
    setLocale(getStoredLocale());
    const onLocaleChange = (event: Event) => {
      setLocale((event as CustomEvent<Locale>).detail);
    };
    window.addEventListener("linguadesk:locale-change", onLocaleChange);
    return () => window.removeEventListener("linguadesk:locale-change", onLocaleChange);
  }, []);

  const dict = DICTIONARIES[locale];
  const current = workspaces.find((workspace) => workspace.id === currentId);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname === href || pathname.startsWith(`${href}/`);

  const content = (
    <div className="flex h-full flex-col bg-navy-950 text-white">
      <div className="flex items-center justify-between px-5 pt-5">
        <Link href="/dashboard" onClick={onClose} className="flex items-center gap-2" aria-label="LinguaDesk AI dashboard">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500 text-lg font-bold text-white" aria-hidden="true">
            L
          </span>
          <span className="text-lg font-bold">
            LinguaDesk <span className="text-teal-400">AI</span>
          </span>
        </Link>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="rounded-lg p-2 text-slate-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 lg:hidden"
        >
          <span aria-hidden="true" className="text-xl leading-none">×</span>
        </button>
      </div>

      <div className="px-4 pt-5">
        <label htmlFor="workspace-switcher" className="px-1 text-xs font-medium uppercase tracking-wider text-slate-400">
          {dict.workspace}
        </label>
        <select
          id="workspace-switcher"
          value={current?.id ?? ""}
          onChange={async (event) => {
            const nextId = event.target.value;
            if (!nextId || nextId === current?.id) return;
            await onSwitch?.(nextId);
            // The server action sets the workspace cookie; refresh so
            // every dashboard page re-resolves to the new workspace.
            router.refresh();
          }}
          disabled={workspaces.length === 0}
          className="mt-1 w-full rounded-lg border border-slate-700 bg-navy-900 px-3 py-2 text-sm text-white focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-60"
        >
          {workspaces.length === 0 ? (
            <option value="">—</option>
          ) : (
            workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))
          )}
        </select>
        {onCreateWorkspace && (
          <button
            type="button"
            onClick={onCreateWorkspace}
            className="mt-2 w-full rounded-lg px-3 py-1.5 text-left text-sm text-teal-400 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            + {dict.createWorkspace}
          </button>
        )}
      </div>

      <nav className="mt-4 flex-1 overflow-y-auto px-3 pb-4" aria-label="Dashboard">
        <ul className="space-y-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 ${
                    active
                      ? "bg-teal-600 font-semibold text-white"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{dict[item.key]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <LanguageSelector value={locale} onChange={setLocale} />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block" aria-label="Sidebar">
        {content}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="absolute inset-0 cursor-default bg-navy-950/60"
          />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-xl">{content}</aside>
        </div>
      )}
    </>
  );
}

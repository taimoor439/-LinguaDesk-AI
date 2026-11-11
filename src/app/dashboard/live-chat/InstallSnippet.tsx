"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { DICTIONARIES, getStoredLocale, type Locale } from "@/lib/i18n";

/**
 * The per-workspace install snippet with a copy button.
 * The snippet only starts a working widget once a widget config exists
 * for the workspace — when there is none, the card says so honestly.
 */
export function InstallSnippet({
  snippet,
  hasConfig,
  appUrlConfigured,
}: {
  snippet: string;
  hasConfig: boolean;
  appUrlConfigured: boolean;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLocale(getStoredLocale());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Locale>).detail;
      if (detail) setLocale(detail);
    };
    window.addEventListener("linguadesk:locale-change", onChange);
    return () => window.removeEventListener("linguadesk:locale-change", onChange);
  }, []);

  const dict = DICTIONARIES[locale];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
    } catch {
      // Clipboard API unavailable (e.g. non-secure context) — fall back.
      const textarea = document.createElement("textarea");
      textarea.value = snippet;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-4">
      <pre className="overflow-x-auto rounded-md bg-slate-900 p-3 text-sm text-slate-100">
        <code>{snippet}</code>
      </pre>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={copy}>
          {copied ? dict.copied : dict.copySnippet}
        </Button>
        {!hasConfig && (
          <p className="text-sm text-amber-700">
            Save a widget configuration first — the snippet does nothing until this
            workspace has one.
          </p>
        )}
        {!appUrlConfigured && (
          <p className="text-sm text-amber-700">
            This snippet uses a relative path, so it only works on pages served
            from the same origin as LinguaDesk. Set NEXT_PUBLIC_APP_URL to get a
            snippet that works on any website.
          </p>
        )}
      </div>
      <p className="mt-3 text-sm text-gray-500">
        Paste this before the closing <code>&lt;/body&gt;</code> tag of your
        website. Visitors can then chat from any page; their messages appear
        in the inbox and your replies reach them in the widget.
      </p>
    </div>
  );
}

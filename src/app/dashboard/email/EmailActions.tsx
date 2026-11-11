"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { getStoredLocale, t, type Locale } from "@/lib/i18n";
import {
  startEmailConnect,
  disconnectEmailAccount,
  syncEmailAccount,
} from "@/lib/email-actions";
import type { EmailProvider } from "@/lib/email/config";

/**
 * Connect / Sync / Disconnect controls for one email provider card.
 *
 * The buttons are disabled with an honest reason while the provider
 * is unconfigured or token encryption is missing — the server actions
 * refuse with the same errors, so the UI can never pretend a
 * connection or sync happened. Connect redirects the browser to the
 * provider authorize URL returned by the server action.
 */
export default function EmailActions({
  provider,
  label,
  connected,
  oauthConfigured,
  missingEnvVars,
  encryptionConfigured,
}: {
  provider: EmailProvider;
  label: string;
  connected: boolean;
  oauthConfigured: boolean;
  missingEnvVars: string[];
  encryptionConfigured: boolean;
}) {
  const [locale, setLocale] = useState<Locale>("en");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
  }, []);

  const connectDisabledReason = !oauthConfigured
    ? `${t(locale, "emailNotConfigured")} — set ${missingEnvVars.join(" and ")}.`
    : !encryptionConfigured
      ? t(locale, "emailEncryptionNotConfigured")
      : null;
  const syncDisabledReason = !connected
    ? `Connect ${label} first.`
    : !encryptionConfigured
      ? t(locale, "emailEncryptionNotConfigured")
      : null;

  const handleConnect = async (event: FormEvent) => {
    event.preventDefault();
    if (connectDisabledReason) return;
    setBusy("connect");
    setError(null);
    setResult(null);
    const res = await startEmailConnect(provider);
    setBusy(null);
    if (res.error || !res.data) {
      setError(res.error ?? "Could not start the connection.");
      return;
    }
    window.location.href = res.data.authorizeUrl;
  };

  const handleSync = async (event: FormEvent) => {
    event.preventDefault();
    if (syncDisabledReason) return;
    setBusy("sync");
    setError(null);
    setResult(null);
    const res = await syncEmailAccount(provider);
    setBusy(null);
    if (res.error || !res.data) {
      setError(res.error ?? "Sync failed.");
      return;
    }
    setResult(
      `Sync complete: ${res.data.imported} imported, ${res.data.skipped} skipped.`,
    );
  };

  const handleDisconnect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("disconnect");
    setError(null);
    setResult(null);
    const res = await disconnectEmailAccount(provider);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setResult(`${label} disconnected — stored tokens were cleared.`);
  };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap gap-2">
        {!connected ? (
          <form onSubmit={handleConnect}>
            <Button
              type="submit"
              size="sm"
              loading={busy === "connect"}
              disabled={Boolean(connectDisabledReason) || busy !== null}
            >
              {provider === "gmail" ? t(locale, "connectGmail") : t(locale, "connectMicrosoft")}
            </Button>
          </form>
        ) : (
          <>
            <form onSubmit={handleSync}>
              <Button
                type="submit"
                size="sm"
                loading={busy === "sync"}
                disabled={Boolean(syncDisabledReason) || busy !== null}
              >
                {t(locale, "syncNow")}
              </Button>
            </form>
            <form onSubmit={handleDisconnect}>
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                loading={busy === "disconnect"}
                disabled={busy !== null}
              >
                {t(locale, "disconnectAccount")}
              </Button>
            </form>
          </>
        )}
      </div>
      {connectDisabledReason && !connected ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {connectDisabledReason}
        </p>
      ) : null}
      {syncDisabledReason && connected ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {syncDisabledReason}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {result}
        </p>
      ) : null}
    </div>
  );
}

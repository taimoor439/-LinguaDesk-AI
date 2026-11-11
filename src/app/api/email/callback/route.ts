/**
 * Email OAuth callback route handler: GET /api/email/callback
 *
 * The provider redirects here with `code` + `state` after the user
 * authorises LinguaDesk. This handler:
 * 1. shows the provider's own error when it refused (never a fake success),
 * 2. verifies the `state` value against the httpOnly nonce cookie
 *    (mismatch → 400 error page, no token stored),
 * 3. verifies the signed-in user belongs to the workspace in `state`,
 * 4. refuses when token encryption is not configured,
 * 5. exchanges the code for tokens, fetches the account email,
 *    encrypts the tokens (AES-256-GCM) and upserts the email_accounts
 *    row, then redirects to /dashboard/email with a success note.
 *
 * Missing code/state → 400-style error page, never a crash.
 * No tokens are ever stored unencrypted.
 */

import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  OAUTH_STATE_COOKIE,
  PROVIDER_LABELS,
  type EmailProvider,
} from "@/lib/email/config";
import {
  encryptToken,
  isEncryptionConfigured,
  ENCRYPTION_KEY_ERROR,
} from "@/lib/email/crypto";
import { exchangeCodeForTokens, fetchAccountEmail } from "@/lib/email/providers";
import { SupabaseEmailStore } from "@/lib/email/store";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function errorPage(message: string, status = 400): NextResponse {
  const safe = escapeHtml(message);
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Email connection failed — LinguaDesk AI</title><style>body{font-family:system-ui,sans-serif;background:#f1f5f9;color:#0f172a;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}main{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;max-width:560px}h1{font-size:20px;margin:0 0 12px}p{font-size:15px;line-height:1.6;color:#475569}a{color:#0d9488;font-weight:600}</style></head><body><main><h1>Email connection failed</h1><p>${safe}</p><p><a href="/dashboard/email">&larr; Back to Email settings</a></p></main></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

interface OAuthState {
  w: string;
  p: EmailProvider;
  n: string;
}

function decodeState(raw: string | null): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") return null;
    const s = parsed as Record<string, unknown>;
    if (typeof s.w !== "string" || typeof s.n !== "string") return null;
    if (s.p !== "gmail" && s.p !== "microsoft") return null;
    return { w: s.w, p: s.p, n: s.n };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const params = request.url ? new URL(request.url).searchParams : new URLSearchParams();
  const providerParam = params.get("provider");
  const code = params.get("code");
  const stateRaw = params.get("state");
  const providerError = params.get("error");
  const providerErrorDescription = params.get("error_description");

  if (providerError) {
    const label = providerParam === "microsoft" ? "Microsoft" : providerParam === "gmail" ? "Google" : "The provider";
    return errorPage(
      `${label} refused the connection: ${providerErrorDescription ?? providerError}. No account was connected.`,
    );
  }

  if (!code || !stateRaw) {
    return errorPage(
      "This link is missing the authorisation code or state. Start the connection again from Email settings — do not open this URL directly.",
    );
  }

  const state = decodeState(stateRaw);
  if (!state) {
    return errorPage("The authorisation state could not be read. Start the connection again from Email settings.");
  }

  const nonceCookie = cookies().get(OAUTH_STATE_COOKIE)?.value;
  if (!nonceCookie || nonceCookie !== state.n) {
    return errorPage(
      "The authorisation state does not match this browser session (possible CSRF attempt). No tokens were stored — start the connection again from Email settings.",
    );
  }

  if (!isSupabaseConfigured()) {
    return errorPage("Supabase is not configured, so the account cannot be saved. Finish setup first, then connect again.");
  }
  if (!isEncryptionConfigured()) {
    return errorPage(`${ENCRYPTION_KEY_ERROR} No tokens were stored.`);
  }

  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("error", "Sign in again, then reconnect the email account.");
    return NextResponse.redirect(login);
  }
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", state.w)
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!membership) {
    return errorPage("You are not a member of the workspace this connection was started for. No tokens were stored.");
  }

  const label = PROVIDER_LABELS[state.p];
  const { data: tokens, error: exchangeError } = await exchangeCodeForTokens(state.p, code);
  if (exchangeError || !tokens) {
    return errorPage(`${label} could not complete the connection: ${exchangeError ?? "no tokens returned"}. No account was connected.`);
  }

  const { data: accountEmail, error: profileError } = await fetchAccountEmail(state.p, tokens.access_token);
  if (profileError || !accountEmail) {
    return errorPage(`${label} connected but no account email could be read: ${profileError ?? "unknown error"}. No account was saved.`);
  }

  const { data: encAccess, error: encError } = encryptToken(tokens.access_token);
  if (encError || !encAccess) {
    return errorPage(`${encError ?? "Could not encrypt the tokens."} No tokens were stored.`);
  }
  let encRefresh: string | null = null;
  if (tokens.refresh_token) {
    const enc = encryptToken(tokens.refresh_token);
    if (!enc.data) {
      return errorPage(`${enc.error ?? "Could not encrypt the refresh token."} No tokens were stored.`);
    }
    encRefresh = enc.data;
  }
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null;

  const store = new SupabaseEmailStore(supabase);
  const upsertError = await store.upsertAccount(
    state.w,
    state.p,
    accountEmail,
    encAccess,
    encRefresh,
    expiresAt,
  );
  if (upsertError) {
    return errorPage(`The ${label} tokens were received but could not be saved: ${upsertError}`);
  }

  cookies().delete(OAUTH_STATE_COOKIE);
  const redirect = new URL("/dashboard/email", request.url);
  redirect.searchParams.set("connected", state.p);
  return NextResponse.redirect(redirect);
}

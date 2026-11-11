/**
 * Email provider configuration — server-side only (reads OAuth secrets).
 *
 * No OAuth clients exist yet: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * and MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET are all empty in
 * .env.local, so every `is*Configured()` check below is false until
 * the user creates clients in the Google / Microsoft consoles and
 * fills in the values. The UI must show that honestly and the connect
 * actions must refuse — never pretend a connection exists.
 *
 * Base-URL overrides (GMAIL_API_BASE_URL, GRAPH_API_BASE_URL,
 * GOOGLE_OAUTH_BASE_URL, MICROSOFT_OAUTH_BASE_URL) exist so tests can
 * point the provider clients at a local stub server, following the
 * same pattern as Phase 4's OPENAI_BASE_URL. They default to the real
 * provider endpoints.
 */

export type EmailProvider = "gmail" | "microsoft";

export const EMAIL_PROVIDERS: EmailProvider[] = ["gmail", "microsoft"];

export const PROVIDER_LABELS: Record<EmailProvider, string> = {
  gmail: "Gmail",
  microsoft: "Microsoft",
};

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];

export const MICROSOFT_SCOPES = ["Mail.Read", "Mail.Send", "offline_access"];

const PLACEHOLDER_PATTERNS = ["your-", "your_", "placeholder", "example", "changeme"];

function looksReal(value: string | undefined): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (trimmed.length < 3) return false;
  const lower = trimmed.toLowerCase();
  return !PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

/** Env vars a provider needs, and which of them are missing. */
export function getProviderEnvStatus(provider: EmailProvider): {
  configured: boolean;
  missing: string[];
} {
  const vars =
    provider === "gmail"
      ? ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]
      : ["MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET"];
  const missing = vars.filter((name) => !looksReal(process.env[name]));
  return { configured: missing.length === 0, missing };
}

export function isProviderConfigured(provider: EmailProvider): boolean {
  return getProviderEnvStatus(provider).configured;
}

/** The OAuth redirect URI both providers must be configured with. */
export function getEmailRedirectUri(): string {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${appUrl}/api/email/callback`;
}

export function getGmailBaseUrl(): string {
  return process.env.GMAIL_API_BASE_URL?.trim().replace(/\/$/, "") || "https://gmail.googleapis.com/gmail/v1";
}

export function getGraphBaseUrl(): string {
  return process.env.GRAPH_API_BASE_URL?.trim().replace(/\/$/, "") || "https://graph.microsoft.com/v1.0";
}

export function getGoogleOAuthBaseUrl(): string {
  return process.env.GOOGLE_OAUTH_BASE_URL?.trim().replace(/\/$/, "") || "https://oauth2.googleapis.com";
}

export function getMicrosoftOAuthBaseUrl(): string {
  return process.env.MICROSOFT_OAUTH_BASE_URL?.trim().replace(/\/$/, "") || "https://login.microsoftonline.com";
}

function getGoogleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
}

function getMicrosoftClientId(): string {
  return process.env.MICROSOFT_CLIENT_ID?.trim() ?? "";
}

/**
 * Build the provider authorize URL for a connect flow. Returns null
 * when the provider's OAuth client is not configured — callers must
 * refuse instead of redirecting anywhere.
 */
export function buildAuthorizeUrl(provider: EmailProvider, state: string): string | null {
  if (!isProviderConfigured(provider)) return null;
  const redirectUri = getEmailRedirectUri();
  if (provider === "gmail") {
    const params = new URLSearchParams({
      client_id: getGoogleClientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: GMAIL_SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  const params = new URLSearchParams({
    client_id: getMicrosoftClientId(),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: MICROSOFT_SCOPES.join(" "),
    state,
  });
  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
}

/** Cookie holding the OAuth CSRF nonce for the in-flight connect. */
export const OAUTH_STATE_COOKIE = "linguadesk_email_oauth";

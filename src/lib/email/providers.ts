/**
 * Gmail + Microsoft Graph clients — server-side only, plain fetch.
 *
 * No new npm dependencies. Every function returns `{ data, error }`
 * and never throws; provider errors are mapped to plain language and
 * never leak response bodies that could contain token material.
 *
 * Base URLs come from src/lib/email/config.ts so tests can point these
 * clients at a local stub server via GMAIL_API_BASE_URL /
 * GRAPH_API_BASE_URL / GOOGLE_OAUTH_BASE_URL /
 * MICROSOFT_OAUTH_BASE_URL. There are currently NO OAuth clients and
 * NO test mailboxes, so no live provider call has been (or could be)
 * made — live sync/send are untested by definition.
 *
 * Threading notes (honest):
 * - Gmail: replies are threaded by passing the original `threadId`
 *   to users.messages.send. In-Reply-To/References headers are not
 *   sent because the original Message-ID header is not stored
 *   (migration 0005 stores only the provider message id); Gmail's own
 *   threading via threadId is what groups the reply.
 * - Microsoft Graph: /me/sendMail accepts no conversationId (it is
 *   read-only on the message resource), so a reply to a known
 *   original message uses POST /me/messages/{id}/reply, which keeps
 *   the reply in the same conversation; /me/sendMail is only the
 *   fallback when no original message id is known.
 */

import {
  getGmailBaseUrl,
  getGraphBaseUrl,
  getGoogleOAuthBaseUrl,
  getMicrosoftOAuthBaseUrl,
  getEmailRedirectUri,
  type EmailProvider,
} from "./config";

const DEFAULT_TIMEOUT_MS = 30_000;

export interface ProviderTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_in?: number | null;
}

export interface NormalizedEmail {
  /** Provider message id (Gmail id / Graph id) — used for dedupe. */
  providerMessageId: string;
  /** Provider thread/conversation id — groups messages into one conversation. */
  providerThreadId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  body: string;
  receivedAt: string | null;
}

type Result<T> = { data: T | null; error: string | null };

function fail<T>(error: string): Result<T> {
  return { data: null, error };
}

async function fetchJson(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<{ status: number; payload: unknown; error: string | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return { status: response.status, payload, error: `HTTP ${response.status}` };
    }
    return { status: response.status, payload, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: 0, payload: null, error: "request timed out" };
    }
    return { status: 0, payload: null, error: "network error" };
  } finally {
    clearTimeout(timer);
  }
}

function providerError(provider: EmailProvider, status: number, detail: string | null): string {
  const label = provider === "gmail" ? "Gmail" : "Microsoft Graph";
  if (status === 401) return `${label} rejected the access token (401). Reconnect the account.`;
  if (status === 403) return `${label} refused the request (403) — the granted scopes may be missing.`;
  if (status === 429) return `${label} rate limit reached (429). Please try again in a moment.`;
  if (status >= 500) return `${label} service is unavailable (HTTP ${status}). Please try again later.`;
  if (status === 0) return `${label} request failed (${detail ?? "network error"}).`;
  return `${label} request failed (HTTP ${status}).`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// OAuth token exchange / refresh
// ---------------------------------------------------------------------------

export async function exchangeCodeForTokens(
  provider: EmailProvider,
  code: string,
): Promise<Result<ProviderTokens>> {
  const redirectUri = getEmailRedirectUri();
  if (provider === "gmail") {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const { status, payload, error } = await fetchJson(`${getGoogleOAuthBaseUrl()}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (error) {
      const detail = asRecord(payload)?.error_description ?? asRecord(payload)?.error;
      return fail(
        detail && typeof detail === "string"
          ? `Google refused the code exchange: ${detail}`
          : providerError(provider, status, error),
      );
    }
    const rec = asRecord(payload);
    const accessToken = rec ? asString(rec.access_token) : null;
    if (!accessToken) return fail("Google returned no access token.");
    return {
      data: {
        access_token: accessToken,
        refresh_token: asString(rec?.refresh_token),
        expires_in: typeof rec?.expires_in === "number" ? rec.expires_in : null,
      },
      error: null,
    };
  }

  const body = new URLSearchParams({
    code,
    client_id: process.env.MICROSOFT_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "",
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    scope: "Mail.Read Mail.Send offline_access",
  });
  const { status, payload, error } = await fetchJson(
    `${getMicrosoftOAuthBaseUrl()}/common/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );
  if (error) {
    const detail = asRecord(payload)?.error_description ?? asRecord(payload)?.error;
    return fail(
      detail && typeof detail === "string"
        ? `Microsoft refused the code exchange: ${detail}`
        : providerError(provider, status, error),
    );
  }
  const rec = asRecord(payload);
  const accessToken = rec ? asString(rec.access_token) : null;
  if (!accessToken) return fail("Microsoft returned no access token.");
  return {
    data: {
      access_token: accessToken,
      refresh_token: asString(rec?.refresh_token),
      expires_in: typeof rec?.expires_in === "number" ? rec.expires_in : null,
    },
    error: null,
  };
}

export async function refreshAccessToken(
  provider: EmailProvider,
  refreshToken: string,
): Promise<Result<ProviderTokens>> {
  if (provider === "gmail") {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
      grant_type: "refresh_token",
    });
    const { status, payload, error } = await fetchJson(`${getGoogleOAuthBaseUrl()}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (error) {
      const detail = asRecord(payload)?.error_description ?? asRecord(payload)?.error;
      return fail(
        detail && typeof detail === "string"
          ? `Google refused the token refresh: ${detail}`
          : providerError(provider, status, error),
      );
    }
    const rec = asRecord(payload);
    const accessToken = rec ? asString(rec.access_token) : null;
    if (!accessToken) return fail("Google returned no access token on refresh.");
    return {
      data: {
        access_token: accessToken,
        refresh_token: asString(rec?.refresh_token) ?? refreshToken,
        expires_in: typeof rec?.expires_in === "number" ? rec.expires_in : null,
      },
      error: null,
    };
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.MICROSOFT_CLIENT_ID?.trim() ?? "",
    client_secret: process.env.MICROSOFT_CLIENT_SECRET?.trim() ?? "",
    grant_type: "refresh_token",
    scope: "Mail.Read Mail.Send offline_access",
  });
  const { status, payload, error } = await fetchJson(
    `${getMicrosoftOAuthBaseUrl()}/common/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    },
  );
  if (error) {
    const detail = asRecord(payload)?.error_description ?? asRecord(payload)?.error;
    return fail(
      detail && typeof detail === "string"
        ? `Microsoft refused the token refresh: ${detail}`
        : providerError(provider, status, error),
    );
  }
  const rec = asRecord(payload);
  const accessToken = rec ? asString(rec.access_token) : null;
  if (!accessToken) return fail("Microsoft returned no access token on refresh.");
  return {
    data: {
      access_token: accessToken,
      refresh_token: asString(rec?.refresh_token) ?? refreshToken,
      expires_in: typeof rec?.expires_in === "number" ? rec.expires_in : null,
    },
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Account identity
// ---------------------------------------------------------------------------

export async function fetchAccountEmail(
  provider: EmailProvider,
  accessToken: string,
): Promise<Result<string>> {
  if (provider === "gmail") {
    const { status, payload, error } = await fetchJson(
      `${getGmailBaseUrl()}/users/me/profile`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (error) return fail(providerError(provider, status, error));
    const email = asRecord(payload) ? asString(asRecord(payload)!.emailAddress) : null;
    if (!email) return fail("Gmail returned no email address for this account.");
    return { data: email, error: null };
  }
  const { status, payload, error } = await fetchJson(`${getGraphBaseUrl()}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) return fail(providerError(provider, status, error));
  const rec = asRecord(payload);
  const email = rec ? asString(rec.mail) ?? asString(rec.userPrincipalName) : null;
  if (!email) return fail("Microsoft Graph returned no email address for this account.");
  return { data: email, error: null };
}

// ---------------------------------------------------------------------------
// Parsing helpers (pure — unit-testable)
// ---------------------------------------------------------------------------

/** Decode base64url (Gmail) to UTF-8 text. Returns "" on bad input. */
export function decodeBase64Url(value: string): string {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Simple HTML → text stripper, documented limitation: it is NOT a
 * full HTML parser. It drops <script>/<style> blocks, turns <br> and
 * closing block tags into newlines, strips remaining tags, decodes
 * the common entities (&amp; &lt; &gt; &quot; &#39; &nbsp;), and
 * collapses whitespace. Good enough for email bodies; a crafted
 * message can still leave artefacts behind.
 */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|hr)[^>]*>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ADDRESS_RE = /^(.*?)<?([^\s<>]+@[^\s<>]+)>?$/;

/** Parse a From header / address into { name, email }. */
export function parseAddress(raw: string | null | undefined): { name: string | null; email: string } {
  const value = (raw ?? "").trim();
  if (!value) return { name: null, email: "" };
  const match = ADDRESS_RE.exec(value);
  if (!match) return { name: null, email: value };
  const name = (match[1] ?? "").trim().replace(/^["']|["']$/g, "").trim();
  return { name: name || null, email: match[2] ?? value };
}

function headerValue(headers: { name: string; value: string }[], name: string): string | null {
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found ? found.value : null;
}

interface GmailPart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
}

function findPlainTextPart(part: GmailPart | null | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const found = findPlainTextPart(sub);
      if (found !== null) return found;
    }
  }
  return null;
}

function findHtmlPart(part: GmailPart | null | undefined): string | null {
  if (!part) return null;
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts) {
    for (const sub of part.parts) {
      const found = findHtmlPart(sub);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Normalize one Gmail messages.get (format=full) payload. Pure. */
export function parseGmailMessage(raw: unknown): NormalizedEmail | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = asString(rec.id);
  if (!id) return null;
  const threadId = asString(rec.threadId) ?? id;
  const headers = Array.isArray(rec.payload)
    ? []
    : (asRecord(rec.payload)?.headers as { name: string; value: string }[] | undefined) ?? [];
  const from = parseAddress(headerValue(headers, "From"));
  const subject = headerValue(headers, "Subject");
  const dateHeader = headerValue(headers, "Date");
  const payloadPart = asRecord(rec.payload) as GmailPart | null;
  const plain = findPlainTextPart(payloadPart);
  const html = plain === null ? findHtmlPart(payloadPart) : null;
  const body = plain ?? (html !== null ? stripHtmlToText(html) : "") ?? "";
  const snippet = asString(rec.snippet) ?? "";
  return {
    providerMessageId: id,
    providerThreadId: threadId,
    fromEmail: from.email,
    fromName: from.name,
    subject,
    body: body.trim() || snippet,
    receivedAt: dateHeader ? new Date(dateHeader).toISOString() : null,
  };
}

/** Normalize one Microsoft Graph message resource. Pure. */
export function parseGraphMessage(raw: unknown): NormalizedEmail | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = asString(rec.id);
  if (!id) return null;
  const conversationId = asString(rec.conversationId) ?? id;
  const fromRec = asRecord(rec.from);
  const addrRec = fromRec ? asRecord(fromRec.emailAddress) : null;
  const fromEmail = addrRec ? (asString(addrRec.address) ?? "") : "";
  const fromName = addrRec ? asString(addrRec.name) : null;
  const bodyRec = asRecord(rec.body);
  const content = bodyRec ? (asString(bodyRec.content) ?? "") : "";
  const contentType = bodyRec ? asString(bodyRec.contentType) : null;
  const body = contentType === "html" ? stripHtmlToText(content) : content;
  const received = asString(rec.receivedDateTime);
  return {
    providerMessageId: id,
    providerThreadId: conversationId,
    fromEmail,
    fromName,
    subject: asString(rec.subject),
    body: body.trim(),
    receivedAt: received ? new Date(received).toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// Fetching messages
// ---------------------------------------------------------------------------

export async function listGmailMessages(
  accessToken: string,
): Promise<Result<{ id: string; threadId: string }[]>> {
  const url = new URL(`${getGmailBaseUrl()}/users/me/messages`);
  url.searchParams.set("labelIds", "INBOX");
  url.searchParams.set("maxResults", "25");
  const { status, payload, error } = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) return fail(providerError("gmail", status, error));
  const rec = asRecord(payload);
  const messages = rec && Array.isArray(rec.messages) ? rec.messages : [];
  const out: { id: string; threadId: string }[] = [];
  for (const item of messages as unknown[]) {
    const r = asRecord(item);
    const id = r ? asString(r.id) : null;
    if (id) out.push({ id, threadId: asString(r?.threadId) ?? id });
  }
  return { data: out, error: null };
}

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<Result<NormalizedEmail>> {
  const url = new URL(`${getGmailBaseUrl()}/users/me/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "full");
  const { status, payload, error } = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) return fail(providerError("gmail", status, error));
  const parsed = parseGmailMessage(payload);
  if (!parsed) return fail("Gmail returned an unreadable message.");
  return { data: parsed, error: null };
}

export async function listGraphMessages(
  accessToken: string,
): Promise<Result<NormalizedEmail[]>> {
  const url = new URL(`${getGraphBaseUrl()}/me/messages`);
  url.searchParams.set("$top", "25");
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set(
    "$select",
    "id,conversationId,from,subject,receivedDateTime,body",
  );
  const { status, payload, error } = await fetchJson(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (error) return fail(providerError("microsoft", status, error));
  const rec = asRecord(payload);
  const values = rec && Array.isArray(rec.value) ? rec.value : [];
  const out: NormalizedEmail[] = [];
  for (const item of values as unknown[]) {
    const parsed = parseGraphMessage(item);
    if (parsed) out.push(parsed);
  }
  return { data: out, error: null };
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

/** Send via Gmail. Threaded with threadId when provided. */
export async function sendGmailMessage(
  accessToken: string,
  input: SendEmailInput & { threadId?: string | null },
): Promise<Result<{ providerMessageId: string }>> {
  const rfc822 = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body,
  ].join("\r\n");
  const payload: Record<string, string> = { raw: encodeBase64Url(rfc822) };
  if (input.threadId) payload.threadId = input.threadId;
  const { status, payload: resp, error } = await fetchJson(
    `${getGmailBaseUrl()}/users/me/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
  if (error) return fail(providerError("gmail", status, error));
  const id = asRecord(resp) ? asString(asRecord(resp)!.id) : null;
  if (!id) return fail("Gmail accepted the message but returned no message id.");
  return { data: { providerMessageId: id }, error: null };
}

/**
 * Send via Microsoft Graph. When the original message id is known,
 * POST /me/messages/{id}/reply keeps the reply in the same
 * conversation; otherwise /me/sendMail sends a new message.
 */
export async function sendGraphMessage(
  accessToken: string,
  input: SendEmailInput & { originalMessageId?: string | null },
): Promise<Result<{ providerMessageId: string }>> {
  if (input.originalMessageId) {
    const { status, payload, error } = await fetchJson(
      `${getGraphBaseUrl()}/me/messages/${encodeURIComponent(input.originalMessageId)}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment: input.body }),
      },
    );
    if (error) return fail(providerError("microsoft", status, error));
    const id = asRecord(payload) ? asString(asRecord(payload)!.id) : null;
    // Graph's reply endpoint returns 202 with an empty body in some
    // tenants; treat a 2xx with no id as sent but unprovable.
    if (!id) return { data: { providerMessageId: "" }, error: null };
    return { data: { providerMessageId: id }, error: null };
  }

  const { status, payload, error } = await fetchJson(`${getGraphBaseUrl()}/me/sendMail`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: { contentType: "Text", content: input.body },
        toRecipients: [{ emailAddress: { address: input.to } }],
      },
      saveToSentItems: true,
    }),
  });
  if (error) return fail(providerError("microsoft", status, error));
  const rec = asRecord(payload);
  const id = rec ? asString(rec.id) : null;
  // sendMail returns 202 with an empty body — sent, but no id to store.
  return { data: { providerMessageId: id ?? "" }, error: null };
}

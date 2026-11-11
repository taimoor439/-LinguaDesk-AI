/**
 * Shared helpers for the public widget API (`/api/widget/*`).
 *
 * SECURITY RULES
 * - These routes use ONLY the anon Supabase client, built here without
 *   request cookies (the widget runs on third-party sites with no
 *   session). The service-role key is never used here and no key ever
 *   leaves the server — the widget JS talks to these routes, never to
 *   Supabase directly.
 * - Anonymous access is scoped by the 0003 migration: anon can only
 *   touch chat conversations in workspaces that have a widget
 *   configured, and can never insert agent/ai messages.
 * - Conversation ids are unguessable UUIDs; knowing one is the only
 *   "authentication" a visitor has (same pattern as an unlisted URL).
 * - Rate limiting is a naive in-memory per-IP cap. It resets on server
 *   restart and does not span instances — an honest limitation, not a
 *   distributed limiter.
 */
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv, isSupabaseConfigured } from "@/lib/supabase/env";

export const MAX_MESSAGE_LENGTH = 5000;
export const MAX_NAME_LENGTH = 200;
export const MAX_EMAIL_LENGTH = 254;
/** Max POSTs per minute per IP (+ workspace/conversation). */
export const POST_RATE_LIMIT = 30;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value);
}

/**
 * Anon Supabase client for route handlers. No cookies, no persisted
 * session, no service-role key. Returns null when Supabase is not
 * configured (routes answer 500, never leak why in detail).
 */
export function getWidgetAnonClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ---------------------------------------------------------------------------
// CORS + JSON responses (the widget runs on third-party sites)
// ---------------------------------------------------------------------------

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
): NextResponse {
  return NextResponse.json(body, { status, headers: corsHeaders() });
}

export function errorResponse(message: string, status: number): NextResponse {
  return jsonResponse({ error: message }, status);
}

/** Preflight handler shared by every widget route. */
export function optionsResponse(): NextResponse {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// Rate limiting (naive, in-memory, per process)
// ---------------------------------------------------------------------------

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateEntry>();

/**
 * True when the caller is still within the POST cap for this key.
 * Call once per POST, with a key like `ip + workspace` or
 * `ip + conversation`. Resets on server restart; does not span
 * instances.
 */
export function checkPostRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now >= entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= POST_RATE_LIMIT) return false;
  entry.count += 1;
  return true;
}

/** Best-effort client IP from proxy headers. Never trusted for auth. */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

// ---------------------------------------------------------------------------
// Small validators / detectors
// ---------------------------------------------------------------------------

export function parseJsonBody(
  value: unknown,
): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Validate the optional visitor name/email fields.
 * Returns the cleaned values or an error message.
 */
export function validateVisitorIdentity(
  body: Record<string, unknown>,
): { name: string | null; email: string | null; error: string | null } {
  const rawName = asText(body.name);
  const rawEmail = asText(body.email);
  const name = rawName?.trim() ? rawName.trim() : null;
  const email = rawEmail?.trim() ? rawEmail.trim().toLowerCase() : null;
  if (name && name.length > MAX_NAME_LENGTH) {
    return { name: null, email: null, error: "Name is too long." };
  }
  if (email && email.length > MAX_EMAIL_LENGTH) {
    return { name: null, email: null, error: "Email is too long." };
  }
  if (email && !isValidEmail(email)) {
    return { name: null, email: null, error: "Enter a valid email address." };
  }
  return { name, email, error: null };
}

/** Validate a chat message body: non-empty, max 5000 chars. */
export function validateMessageBody(
  body: Record<string, unknown>,
): { text: string; error: string | null } {
  const raw = asText(body.message ?? body.body);
  const text = raw?.trim() ?? "";
  if (!text) return { text: "", error: "Message is required." };
  if (text.length > MAX_MESSAGE_LENGTH) {
    return { text: "", error: "Message is too long (max 5,000 characters)." };
  }
  return { text, error: null };
}

/**
 * Language detection lives in src/lib/ai/detect.ts (heuristic word-list
 * detector — see the note there). Re-exported here so the widget routes
 * keep their existing import.
 */
export { detectLanguage } from "@/lib/ai/detect";

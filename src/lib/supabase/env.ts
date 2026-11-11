/**
 * Supabase environment helpers.
 *
 * Central place for deciding whether Supabase is actually configured.
 * Placeholder values from `.env.example` (e.g. `your-project-ref`,
 * `your-supabase-anon-key`) deliberately do NOT count as configured.
 */

export interface SupabaseEnv {
  url: string | undefined;
  anonKey: string | undefined;
  serviceRoleKey: string | undefined;
}

const PLACEHOLDER_PATTERNS = ["your-", "your_", "placeholder", "example", "changeme"];

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PATTERNS.some((p) => lower.includes(p));
}

function looksLikeUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function getSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return { url, anonKey, serviceRoleKey };
}

/**
 * True only when a real Supabase URL and anon key are present.
 * Returns false for missing values and for `.env.example` placeholders.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) return false;
  if (looksLikePlaceholder(url) || looksLikePlaceholder(anonKey)) return false;
  if (!looksLikeUrl(url)) return false;
  // Anon keys are JWTs; anything very short is not a real key.
  if (anonKey.trim().length < 20) return false;
  return true;
}

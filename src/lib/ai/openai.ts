/**
 * Minimal fetch-based chat-completion client — server-side only.
 *
 * NEVER import this module (or anything that imports it) from a client
 * component: the API key must never reach the browser. Server actions
 * and route handlers only.
 *
 * Provider-aware: AI_PROVIDER selects the backend (default "openai").
 *   - "openai": OPENAI_API_KEY, model OPENAI_MODEL (default gpt-4o-mini),
 *     base URL OPENAI_BASE_URL (default https://api.openai.com/v1).
 *   - "gemini": GEMINI_API_KEY (free key from Google AI Studio),
 *     model GEMINI_MODEL (default gemini-3.5-flash), base URL
 *     GEMINI_BASE_URL (default Gemini's OpenAI-compatible endpoint
 *     https://generativelanguage.googleapis.com/v1beta/openai).
 *     The Gemini endpoint speaks the same OpenAI chat-completions shape,
 *     so no provider-specific request code is needed. Verified live
 *     2026-11-11 with gemini-3.5-flash and gemini-3.5-flash-lite via the
 *     native Gemini API; gemini-3.8-flash and gemini-flash-latest timed
 *     out in that test, so they are NOT the default.
 *
 * No new npm dependencies: plain fetch with an AbortController timeout.
 *
 * When the active provider has no key configured, live calls are
 * untested by definition — see isAiConfigured() and the honest error
 * below.
 */

export type AiProvider = "openai" | "gemini";

export function getAiProvider(): AiProvider {
  return process.env.AI_PROVIDER?.trim().toLowerCase() === "gemini"
    ? "gemini"
    : "openai";
}

export function getAiProviderLabel(): string {
  return getAiProvider() === "gemini" ? "Gemini" : "OpenAI";
}

function getAiKeyEnvVar(): string {
  return getAiProvider() === "gemini" ? "GEMINI_API_KEY" : "OPENAI_API_KEY";
}

export function getAiKey(): string {
  return process.env[getAiKeyEnvVar()]?.trim() ?? "";
}

export function getAiModel(): string {
  if (getAiProvider() === "gemini") {
    return process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash";
  }
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function getAiBaseUrl(): string {
  if (getAiProvider() === "gemini") {
    return (
      process.env.GEMINI_BASE_URL?.trim().replace(/\/$/, "") ||
      "https://generativelanguage.googleapis.com/v1beta/openai"
    );
  }
  return (
    process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.openai.com/v1"
  );
}

export const AI_NOT_CONFIGURED_ERROR =
  "AI is not configured — add an API key (OPENAI_API_KEY, or GEMINI_API_KEY with AI_PROVIDER=gemini)";

export function getAiNotConfiguredError(): string {
  if (getAiProvider() === "gemini") {
    return "AI is not configured — add your Gemini API key (GEMINI_API_KEY)";
  }
  return "AI is not configured — add your OpenAI API key (OPENAI_API_KEY)";
}

const PLACEHOLDER_PATTERNS = ["your-", "your_", "placeholder", "example", "changeme", "sk-..."];

/** True only when a real-looking key for the active provider is present. */
export function isAiConfigured(): boolean {
  const key = getAiKey();
  if (!key) return false;
  if (key.length < 20) return false;
  const lower = key.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some((p) => lower.includes(p))) return false;
  return true;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type ChatResult = { data: string | null; error: string | null };

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * One chat completion. Returns `{ data, error }` and never throws.
 * Errors are mapped to plain language: 401 → invalid key, 429 → rate
 * limited, 5xx / network failure → service unavailable. The raw
 * provider error body is never surfaced (it can contain key material).
 */
export async function chatCompletion(
  messages: ChatMessage[],
  opts?: { temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<ChatResult> {
  if (!isAiConfigured()) {
    return { data: null, error: getAiNotConfiguredError() };
  }
  const label = getAiProviderLabel();

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getAiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAiKey()}`,
      },
      body: JSON.stringify({
        model: getAiModel(),
        messages,
        temperature: opts?.temperature ?? 0.3,
        // 2048, not 600: on Gemini's OpenAI-compat endpoint the model's
        // thinking tokens share the max_tokens budget, and a 600 cap
        // cut replies off mid-sentence (observed 28–87 output tokens).
        // Replies stay short by prompt instruction; this only gives
        // the model room to finish its sentences.
        max_tokens: opts?.maxTokens ?? 2048,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { data: null, error: `${label} rejected the API key (401). Check ${getAiKeyEnvVar()}.` };
      }
      if (response.status === 429) {
        return { data: null, error: `${label} rate limit reached (429). Please try again in a moment.` };
      }
      if (response.status >= 500) {
        return { data: null, error: `${label} service is unavailable (HTTP ${response.status}). Please try again later.` };
      }
      return { data: null, error: `${label} request failed (HTTP ${response.status}).` };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { data: null, error: `${label} returned an unreadable response.` };
    }
    const choices = (payload as { choices?: { message?: { content?: string } }[] })?.choices;
    const content = choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { data: null, error: `${label} returned an empty reply.` };
    }
    return { data: content, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: null, error: `${label} request timed out. Please try again.` };
    }
    return { data: null, error: `${label} service is unavailable. Check the network connection and try again.` };
  } finally {
    clearTimeout(timer);
  }
}

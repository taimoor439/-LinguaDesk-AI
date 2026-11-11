/**
 * Minimal fetch-based OpenAI client — server-side only.
 *
 * NEVER import this module (or anything that imports it) from a client
 * component: the API key must never reach the browser. Server actions
 * and route handlers only.
 *
 * No new npm dependencies: plain fetch with an AbortController timeout.
 * Model and base URL come from the environment so tests can point the
 * client at a local stub server via OPENAI_BASE_URL.
 *
 * There is currently NO OpenAI key configured (OPENAI_API_KEY is empty
 * in .env.local), so live calls are untested by definition — see
 * isAiConfigured() and the honest error below.
 */

export const AI_NOT_CONFIGURED_ERROR =
  "AI is not configured — add your OpenAI API key";

const PLACEHOLDER_PATTERNS = ["your-", "your_", "placeholder", "example", "changeme", "sk-..."];

/** True only when a real-looking OpenAI key is present. */
export function isAiConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return false;
  if (key.length < 20) return false;
  const lower = key.toLowerCase();
  if (PLACEHOLDER_PATTERNS.some((p) => lower.includes(p))) return false;
  return true;
}

export function getOpenAiModel(): string {
  return process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

export function getOpenAiBaseUrl(): string {
  return (
    process.env.OPENAI_BASE_URL?.trim().replace(/\/$/, "") ||
    "https://api.openai.com/v1"
  );
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
    return { data: null, error: AI_NOT_CONFIGURED_ERROR };
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY!.trim()}`,
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        messages,
        temperature: opts?.temperature ?? 0.3,
        max_tokens: opts?.maxTokens ?? 600,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        return { data: null, error: "OpenAI rejected the API key (401). Check OPENAI_API_KEY." };
      }
      if (response.status === 429) {
        return { data: null, error: "OpenAI rate limit reached (429). Please try again in a moment." };
      }
      if (response.status >= 500) {
        return { data: null, error: `OpenAI service is unavailable (HTTP ${response.status}). Please try again later.` };
      }
      return { data: null, error: `OpenAI request failed (HTTP ${response.status}).` };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { data: null, error: "OpenAI returned an unreadable response." };
    }
    const choices = (payload as { choices?: { message?: { content?: string } }[] })?.choices;
    const content = choices?.[0]?.message?.content?.trim() ?? "";
    if (!content) {
      return { data: null, error: "OpenAI returned an empty reply." };
    }
    return { data: content, error: null };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { data: null, error: "OpenAI request timed out. Please try again." };
    }
    return { data: null, error: "OpenAI service is unavailable. Check the network connection and try again." };
  } finally {
    clearTimeout(timer);
  }
}

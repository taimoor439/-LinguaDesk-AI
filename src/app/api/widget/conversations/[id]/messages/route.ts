import type { NextRequest } from "next/server";
import {
  getWidgetAnonClient,
  getClientIp,
  checkPostRateLimit,
  isUuid,
  jsonResponse,
  errorResponse,
  optionsResponse,
  parseJsonBody,
  validateMessageBody,
  detectLanguage,
} from "@/lib/widget-api";
import { maybeAutoReply } from "@/lib/ai/auto-reply";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

interface RouteParams {
  params: { id: string };
}

/**
 * Prove the conversation id is a widget chat conversation and return
 * its workspace id, or null. Anon has no SELECT on conversations, so
 * this goes through the 0003 SECURITY DEFINER function.
 */
async function getChatWorkspace(
  supabase: NonNullable<ReturnType<typeof getWidgetAnonClient>>,
  conversationId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc(
    "get_chat_conversation_workspace",
    { p_conversation_id: conversationId },
  );
  if (error) {
    console.error("widget conversation lookup failed:", error.message);
    return null;
  }
  return typeof data === "string" && data ? data : null;
}

/**
 * GET /api/widget/conversations/[id]/messages
 * Returns the conversation's customer-visible messages, oldest first.
 * Internal notes (sender_type 'system') and unsent AI drafts are
 * NEVER returned — the 0003 policy permits the row, so this filter in
 * code is what keeps them agent-only.
 */
export async function GET(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const conversationId = params.id;
  if (!isUuid(conversationId)) {
    return errorResponse("A valid conversation id is required.", 400);
  }

  const supabase = getWidgetAnonClient();
  if (!supabase) {
    return errorResponse("Widget is not configured.", 500);
  }

  const workspaceId = await getChatWorkspace(supabase, conversationId);
  if (!workspaceId) {
    return errorResponse("Conversation not found.", 404);
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, sender_type, body, language, created_at")
    .eq("conversation_id", conversationId)
    .eq("workspace_id", workspaceId)
    .neq("sender_type", "system")
    .eq("is_ai_draft", false)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    console.error("widget messages lookup failed:", error.message);
    return errorResponse("Could not load messages.", 500);
  }

  return jsonResponse({ messages: data ?? [] });
}

/**
 * POST /api/widget/conversations/[id]/messages — body { body }
 * Appends a customer message and bumps last_message_at. Returns the
 * created message. The response only says the message was stored.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const conversationId = params.id;
  if (!isUuid(conversationId)) {
    return errorResponse("A valid conversation id is required.", 400);
  }

  const supabase = getWidgetAnonClient();
  if (!supabase) {
    return errorResponse("Widget is not configured.", 500);
  }

  const ip = getClientIp(request);
  if (!checkPostRateLimit(`post:messages:${ip}:${conversationId}`)) {
    return errorResponse("Too many requests. Please try again in a minute.", 429);
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON.", 400);
  }
  const body = parseJsonBody(raw);
  if (!body) {
    return errorResponse("Request body must be a JSON object.", 400);
  }

  const { text, error: messageError } = validateMessageBody(body);
  if (messageError) return errorResponse(messageError, 400);

  const workspaceId = await getChatWorkspace(supabase, conversationId);
  if (!workspaceId) {
    return errorResponse("Conversation not found.", 404);
  }

  // Heuristic detection (see src/lib/ai/detect.ts): stored on the
  // message row, and — when this is the first customer message — on
  // the conversation itself via the 0004 function.
  const language = detectLanguage(text);

  // NOTE: the id is generated here and the insert uses no `.select()`
  // (no RETURNING) — anon has no SELECT policy on conversations, and
  // the message is read back below through the anon SELECT policy on
  // messages (0003 policy 5), which does cover widget chat messages.
  const messageId = crypto.randomUUID();
  const { error } = await supabase.from("messages").insert({
    id: messageId,
    conversation_id: conversationId,
    workspace_id: workspaceId,
    sender_type: "customer",
    body: text,
    language,
    is_ai_draft: false,
  });
  if (error) {
    console.error("widget message insert failed:", error.message);
    return errorResponse("Could not store the message.", 500);
  }

  const { data, error: readError } = await supabase
    .from("messages")
    .select("id, sender_type, body, language, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (readError || !data) {
    console.error("widget message read-back failed:", readError?.message);
    return errorResponse("Could not store the message.", 500);
  }

  await supabase.rpc("touch_chat_conversation", {
    p_conversation_id: conversationId,
  });

  // Best-effort: if this was the first customer message, record its
  // detected language on the conversation (0004 function; a no-op for
  // later messages, and an error until 0004 has been run in the SQL
  // Editor — which must not fail the message itself).
  await supabase.rpc("set_chat_conversation_language", {
    p_conversation_id: conversationId,
    p_language: language,
  });

  // Best-effort AI auto-reply (src/lib/ai/auto-reply.ts): when the
  // workspace opted in (widget_configs.ai_auto_reply), the AI answers
  // from the workspace's published Knowledge Base. The visitor's
  // message is already stored, so a slow or failing reply must never
  // delay or break the 201 below — hard 12s cap, and any outcome
  // other than a saved reply just means a human replies manually.
  // maybeAutoReply never throws; the race only bounds its runtime.
  const autoReply = maybeAutoReply({
    workspaceId,
    conversationId,
    customerMessage: text,
    language,
  });
  const autoReplyTimeout = new Promise<{ replied: false; reason: string }>(
    (resolve) => setTimeout(() => resolve({ replied: false, reason: "timeout" }), 12_000),
  );
  const autoReplyResult = await Promise.race([autoReply, autoReplyTimeout]);
  if (!autoReplyResult.replied) {
    console.error("widget auto-reply skipped:", autoReplyResult.reason);
  }

  return jsonResponse({ message: data }, 201);
}

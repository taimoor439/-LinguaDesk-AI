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
  validateVisitorIdentity,
  validateMessageBody,
  detectLanguage,
} from "@/lib/widget-api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/widget/conversations — body { workspaceId, name?, email?, message }
 *
 * Creates a contact (when name/email given) + a chat conversation + the
 * first customer message, and returns { conversationId }.
 *
 * Dedupe: when an email is given and the visitor already has an open
 * chat conversation for this workspace + email, the first message is
 * appended to that conversation instead of starting a new one (via the
 * 0003 `find_chat_context` function — anon has no SELECT on
 * conversations, so the lookup has to go through that function).
 *
 * The response only says the message was stored. It never claims the
 * message reached an agent.
 */
export async function POST(request: NextRequest) {
  const supabase = getWidgetAnonClient();
  if (!supabase) {
    return errorResponse("Widget is not configured.", 500);
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

  const workspaceId = body.workspaceId;
  if (!isUuid(workspaceId)) {
    return errorResponse("A valid workspaceId is required.", 400);
  }

  const ip = getClientIp(request);
  if (!checkPostRateLimit(`post:conversations:${ip}:${workspaceId}`)) {
    return errorResponse("Too many requests. Please try again in a minute.", 429);
  }

  const { text, error: messageError } = validateMessageBody(body);
  if (messageError) return errorResponse(messageError, 400);

  const { name, email, error: identityError } = validateVisitorIdentity(body);
  if (identityError) return errorResponse(identityError, 400);

  // The widget only works for workspaces that configured one.
  const { data: config, error: configError } = await supabase
    .from("widget_configs")
    .select("workspace_id")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (configError) {
    console.error("widget config lookup failed:", configError.message);
    return errorResponse("Could not load the widget configuration.", 500);
  }
  if (!config) {
    return errorResponse("No widget configured for this workspace.", 404);
  }

  const language = detectLanguage(text);
  const now = new Date().toISOString();

  // Returning visitor? Reuse their open chat conversation (and contact).
  if (email) {
    const { data: ctx } = await supabase.rpc("find_chat_context", {
      p_workspace_id: workspaceId,
      p_email: email,
    });
    const row = Array.isArray(ctx) ? (ctx[0] as { conversation_id?: string } | undefined) : undefined;
    const existingId = row?.conversation_id ?? null;
    if (existingId) {
      const { error: insertError } = await supabase.from("messages").insert({
        conversation_id: existingId,
        workspace_id: workspaceId,
        sender_type: "customer",
        body: text,
        language,
        is_ai_draft: false,
      });
      if (insertError) {
        console.error("widget message insert failed:", insertError.message);
        return errorResponse("Could not store the message.", 500);
      }
      await supabase.rpc("touch_chat_conversation", {
        p_conversation_id: existingId,
      });
      // Best-effort: if this was the visitor's first message, record
      // its detected language on the conversation (0004 function; a
      // no-op — and harmless — for later messages, and an error until
      // 0004 has been run in the SQL Editor, which must not fail the
      // message itself).
      await supabase.rpc("set_chat_conversation_language", {
        p_conversation_id: existingId,
        p_language: language,
      });
      return jsonResponse({ conversationId: existingId }, 201);
    }
  }

  // New conversation: create (or reuse) the contact, then the
  // conversation and its first message.
  //
  // NOTE: ids are generated here, in the route, and inserts use no
  // `.select()` (no RETURNING). Anon has no SELECT policy on contacts
  // or conversations, and INSERT ... RETURNING fails RLS when the row
  // cannot be selected back — even when the insert itself is allowed.
  let contactId: string | null = null;
  if (email) {
    const { data: ctx } = await supabase.rpc("find_chat_context", {
      p_workspace_id: workspaceId,
      p_email: email,
    });
    const row = Array.isArray(ctx) ? (ctx[0] as { contact_id?: string } | undefined) : undefined;
    contactId = row?.contact_id ?? null;
  }
  if (!contactId && (name || email)) {
    contactId = crypto.randomUUID();
    const { error: contactError } = await supabase.from("contacts").insert({
      id: contactId,
      workspace_id: workspaceId,
      name,
      email,
      preferred_language: language,
      channel: "chat",
      last_interaction_at: now,
    });
    if (contactError) {
      console.error("widget contact insert failed:", contactError.message);
      return errorResponse("Could not start the conversation.", 500);
    }
  }

  const conversationId = crypto.randomUUID();
  const { error: conversationError } = await supabase
    .from("conversations")
    .insert({
      id: conversationId,
      workspace_id: workspaceId,
      contact_id: contactId,
      channel: "chat",
      status: "open",
      priority: "normal",
      language,
      last_message_at: now,
    });
  if (conversationError) {
    console.error("widget conversation insert failed:", conversationError.message);
    return errorResponse("Could not start the conversation.", 500);
  }

  const { error: messageError2 } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    workspace_id: workspaceId,
    sender_type: "customer",
    body: text,
    language,
    is_ai_draft: false,
  });
  if (messageError2) {
    console.error("widget first message insert failed:", messageError2.message);
    return errorResponse("Could not store the message.", 500);
  }

  return jsonResponse({ conversationId }, 201);
}

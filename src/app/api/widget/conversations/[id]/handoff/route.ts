import type { NextRequest } from "next/server";
import {
  getWidgetAnonClient,
  getClientIp,
  checkPostRateLimit,
  isUuid,
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "@/lib/widget-api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

/**
 * POST /api/widget/conversations/[id]/handoff
 *
 * Flags a human handoff: the conversation becomes priority 'high' +
 * status 'pending' and an agent-only system note ("Visitor requested
 * a human agent") is stored, so it shows up in the dashboard's "Needs
 * attention" list. The agent claims it with the existing AssignForm
 * on the inbox detail page.
 *
 * The mutation goes through the 0003 SECURITY DEFINER function
 * `request_chat_handoff` — anon has no UPDATE policy on conversations.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const conversationId = params.id;
  if (!isUuid(conversationId)) {
    return errorResponse("A valid conversation id is required.", 400);
  }

  const supabase = getWidgetAnonClient();
  if (!supabase) {
    return errorResponse("Widget is not configured.", 500);
  }

  const ip = getClientIp(request);
  if (!checkPostRateLimit(`post:handoff:${ip}:${conversationId}`)) {
    return errorResponse("Too many requests. Please try again in a minute.", 429);
  }

  const { data, error } = await supabase.rpc("request_chat_handoff", {
    p_conversation_id: conversationId,
  });
  if (error) {
    console.error("widget handoff failed:", error.message);
    return errorResponse("Could not request a human agent.", 500);
  }
  if (data !== true) {
    return errorResponse("Conversation not found.", 404);
  }

  return jsonResponse({ ok: true });
}

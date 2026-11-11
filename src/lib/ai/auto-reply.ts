/**
 * AI auto-reply for the website chat widget — server-only.
 *
 * When a workspace has turned AI auto-reply on (widget_configs
 * .ai_auto_reply = true), a new visitor message gets an automatic
 * agent reply, grounded in that workspace's PUBLISHED Knowledge Base
 * articles — the same grounding pipeline as the dashboard AI drafts
 * (rankArticlesForGrounding + an auto-reply prompt built for
 * customer-facing replies), so the model answers only from the
 * workspace's own content. Replies are sharp and short, always end
 * with a next step, and never dead-end the visitor: a greeting gets
 * a warm welcome plus what the business does, and a question with
 * no direct match gets a helpful pointer plus a clarifying
 * question — never a blunt "we have no information".
 *
 * This deliberately differs from the dashboard draft flow: the owner
 * opted in per workspace, so the reply is inserted directly as an
 * agent message instead of a draft needing approval. The visitor sees
 * it on their next widget poll, like any agent reply.
 *
 * SAFETY / JUSTIFICATION for the admin client: the caller (the widget
 * message endpoint) has already proven, via the anon client and the
 * get_chat_conversation_workspace SECURITY DEFINER function, that this
 * conversation is a widget chat conversation of this workspace — and
 * the widget config row itself is public by design (anon-readable,
 * migration 0003). The admin client is used here ONLY to (a) read the
 * workspace's published KB articles, which anon cannot read (they are
 * member-only under RLS), and (b) insert the agent reply message.
 *
 * Best-effort by design: this function NEVER throws. Every failure
 * path returns { replied: false, reason } so the caller can still
 * return 201 for the visitor's message — a human can reply manually.
 * It is only ever called from the customer-message POST path, never
 * from agent inserts, so there is no self-loop.
 *
 * Never import this module (or anything that imports it) from a
 * client component: it reads the service-role key.
 */

import { getAdminClient } from "@/lib/supabase/admin";
import {
  chatCompletion,
  isAiConfigured,
} from "@/lib/ai/openai";
import {
  rankArticlesForGrounding,
  buildAutoReplyPrompt,
  isGreetingMessage,
  type GroundingArticle,
} from "@/lib/ai/grounding";

export interface AutoReplyInput {
  workspaceId: string;
  conversationId: string;
  /** The visitor message that was just stored. */
  customerMessage: string;
  /** Detected language of the visitor message (en | de | fr | it). */
  language: string;
}

export interface AutoReplyResult {
  replied: boolean;
  /** Short machine-readable reason (logged by the caller). */
  reason: string;
}

/** Hard cap for the whole auto-reply attempt (model call included). */
export const AUTO_REPLY_TIMEOUT_MS = 10_000;

export async function maybeAutoReply(
  input: AutoReplyInput,
): Promise<AutoReplyResult> {
  try {
    // (a) No AI key for the active provider: stay silent. This is the
    // normal state until the owner adds GEMINI_API_KEY / OPENAI_API_KEY
    // in the deployment environment — never an error for the visitor.
    if (!isAiConfigured()) {
      return { replied: false, reason: "ai-not-configured" };
    }

    const admin = getAdminClient();
    if (!admin) {
      return { replied: false, reason: "admin-client-unavailable" };
    }

    // (b) Per-workspace opt-in. The column arrives with migration
    // 0007; until it is applied the select errors and auto-reply
    // stays off rather than breaking the visitor's message send.
    const { data: config, error: configError } = await admin
      .from("widget_configs")
      .select("ai_auto_reply")
      .eq("workspace_id", input.workspaceId)
      .maybeSingle();
    if (configError) {
      console.error("widget auto-reply config read failed:", configError.message);
      return { replied: false, reason: "config-read-failed" };
    }
    if (!config || (config as { ai_auto_reply?: boolean }).ai_auto_reply !== true) {
      return { replied: false, reason: "auto-reply-off" };
    }

    // (c) Published KB articles only — drafts are never fed to the model.
    const { data: articles, error: articlesError } = await admin
      .from("knowledge_base_articles")
      .select("id, title, slug, content")
      .eq("workspace_id", input.workspaceId)
      .eq("status", "published")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (articlesError) {
      console.error("widget auto-reply articles read failed:", articlesError.message);
      return { replied: false, reason: "articles-read-failed" };
    }
    const matched = rankArticlesForGrounding(
      input.customerMessage,
      (articles ?? []) as GroundingArticle[],
      3,
    );

    // A greeting ("hi", "?") has no question to ground, so ranking
    // would come back empty and the model would dead-end the visitor.
    // Treat it as a greeting instead, and keep a business overview
    // handy for the greeting and no-match paths so the model always
    // has the business's own facts to offer.
    const allArticles = (articles ?? []) as GroundingArticle[];
    const greeting = isGreetingMessage(input.customerMessage);
    const grounded = greeting ? [] : matched;
    const overview =
      allArticles.find((a) => (a.slug ?? "").startsWith("about")) ??
      allArticles.find((a) => (a.title ?? "").toLowerCase().includes("about")) ??
      allArticles[0] ??
      null;

    // (d) Recent thread context (last 10 messages, oldest first),
    // excluding internal notes and AI drafts so the prompt only sees
    // what the visitor and the agents actually said.
    const { data: thread, error: threadError } = await admin
      .from("messages")
      .select("sender_type, body, is_ai_draft")
      .eq("conversation_id", input.conversationId)
      .eq("workspace_id", input.workspaceId)
      .neq("sender_type", "system")
      .eq("is_ai_draft", false)
      .order("created_at", { ascending: false })
      .limit(10);
    if (threadError) {
      console.error("widget auto-reply thread read failed:", threadError.message);
      return { replied: false, reason: "thread-read-failed" };
    }
    const recent = ((thread ?? []) as { sender_type: string; body: string }[])
      .slice()
      .reverse()
      .map((m) => ({ sender_type: m.sender_type, body: m.body }));

    const { system, user } = buildAutoReplyPrompt(input.language, recent, grounded, {
      greeting,
      businessOverview: overview,
    });

    // (e) Ask the model. chatCompletion never throws and returns
    // { data, error }; the timeout keeps the whole attempt inside the
    // caller's 12s budget for the visitor's 201 response.
    const { data: reply, error: aiError } = await chatCompletion(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { timeoutMs: AUTO_REPLY_TIMEOUT_MS, maxTokens: 600 },
    );
    if (aiError || !reply) {
      console.error("widget auto-reply AI call failed:", aiError ?? "empty reply");
      return { replied: false, reason: "ai-failed" };
    }
    const text = reply.trim();
    if (!text) {
      return { replied: false, reason: "ai-empty" };
    }

    // (f) Insert the reply as a normal agent message — visible to the
    // visitor on their next widget poll — and bump last_message_at so
    // the conversation surfaces in the inbox like any agent reply.
    const { error: insertError } = await admin.from("messages").insert({
      conversation_id: input.conversationId,
      workspace_id: input.workspaceId,
      sender_type: "agent",
      body: text,
      language: input.language,
      is_ai_draft: false,
    });
    if (insertError) {
      console.error("widget auto-reply insert failed:", insertError.message);
      return { replied: false, reason: "insert-failed" };
    }

    await admin
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("workspace_id", input.workspaceId)
      .eq("id", input.conversationId);

    return { replied: true, reason: "replied" };
  } catch (error) {
    // Never throw: a failed auto-reply must never break the visitor's
    // message send. A human can reply manually from the inbox.
    console.error(
      "widget auto-reply failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return { replied: false, reason: "error" };
  }
}

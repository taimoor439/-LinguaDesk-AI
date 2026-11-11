"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace, type ActionResult } from "@/lib/actions";
import {
  getConversationById,
  getMessages,
  getPublishedArticlesForGrounding,
} from "@/lib/db";
import {
  chatCompletion,
  isAiConfigured,
  getAiNotConfiguredError,
} from "@/lib/ai/openai";
import {
  rankArticlesForGrounding,
  buildDraftPrompt,
  buildTranslatePrompt,
  buildSummarizePrompt,
  AI_SUMMARY_PREFIX,
} from "@/lib/ai/grounding";

/**
 * Phase 4 server actions (AI features).
 *
 * Rules, enforced here and in the UI:
 * - Every action first checks isAiConfigured(). When the active
 *   provider's key is missing or a placeholder, the action fails with
 *   getAiNotConfiguredError() — it never fakes a result and never calls
 *   the live API with a fake key.
 * - Drafts ALWAYS need human approval before anything is sent. Nothing
 *   here auto-sends, auto-publishes, or auto-applies. Approving a draft
 *   stores an agent message in the thread (visible to the visitor on
 *   their next widget poll for chat); it does NOT send email — email
 *   sending arrives in Phase 5.
 * - Every action verifies workspace membership via requireWorkspace()
 *   and scopes every query by workspace_id, like actions.ts.
 * - Actions never throw — failures are returned as `{ error }`.
 */

function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

function fail<T>(error: string): ActionResult<T> {
  return { data: null, error };
}

const LANGUAGES = ["en", "de", "fr", "it"] as const;

function isLanguage(value: string): value is (typeof LANGUAGES)[number] {
  return (LANGUAGES as readonly string[]).includes(value);
}

function revalidateConversation(conversationId: string) {
  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  revalidatePath("/dashboard/ai-assistant");
  revalidatePath("/dashboard/overview");
}

interface DraftRow {
  id: string;
  conversation_id: string;
  workspace_id: string;
  body: string;
  language: string | null;
}

/** Load one AI draft, workspace-scoped. Null when it is not a draft here. */
async function loadDraft(
  workspaceId: string,
  draftId: string,
): Promise<DraftRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, conversation_id, workspace_id, body, language")
    .eq("workspace_id", workspaceId)
    .eq("id", draftId)
    .eq("sender_type", "ai")
    .eq("is_ai_draft", true)
    .maybeSingle();
  return (data as unknown as DraftRow | null) ?? null;
}

// ---------------------------------------------------------------------------
// AI draft replies
// ---------------------------------------------------------------------------

/**
 * Generate an AI draft reply for a conversation:
 * 1. loads the conversation + recent messages,
 * 2. retrieves the workspace's PUBLISHED articles and ranks them by
 *    keyword overlap with the latest customer message,
 * 3. asks the model to answer ONLY from the matched articles, in the
 *    customer's language (when nothing matches, the draft must say the
 *    knowledge base has no answer and recommend a human),
 * 4. saves the result as a messages row (sender_type 'ai',
 *    is_ai_draft=true). The draft is never sent — a human approves it
 *    from the AI Assistant page or the inbox first.
 */
export async function generateAiDraft(
  conversationId: string,
): Promise<ActionResult<{ draftId: string }>> {
  if (!isAiConfigured()) return fail(getAiNotConfiguredError());

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const { data: conversation, error: convError } = await getConversationById(
    context.workspaceId,
    conversationId,
  );
  if (convError || !conversation) {
    return fail(convError ?? "Conversation not found in this workspace.");
  }

  const { data: messages, error: messagesError } = await getMessages(
    context.workspaceId,
    conversationId,
  );
  if (messagesError) return fail(messagesError);

  const customerMessages = messages.filter((m) => m.sender_type === "customer");
  if (customerMessages.length === 0) {
    return fail("There is no customer message to answer yet.");
  }
  const latestCustomer = customerMessages[customerMessages.length - 1];
  const language = conversation.language || latestCustomer.language || "en";

  const { data: articles, error: articlesError } =
    await getPublishedArticlesForGrounding(context.workspaceId);
  if (articlesError) return fail(articlesError);

  const matched = rankArticlesForGrounding(latestCustomer.body, articles, 3);
  const recent = messages.slice(-10).map((m) => ({ sender_type: m.sender_type, body: m.body }));
  const { system, user } = buildDraftPrompt(language, recent, matched);

  const { data: draft, error: aiError } = await chatCompletion([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (aiError || !draft) return fail(aiError ?? "The AI returned no draft.");

  const supabase = await createClient();
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      workspace_id: context.workspaceId,
      sender_type: "ai",
      body: draft,
      language,
      is_ai_draft: true,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return fail(insertError?.message ?? "Could not save the AI draft.");
  }

  revalidateConversation(conversationId);
  return ok({ draftId: (inserted as { id: string }).id });
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/**
 * Translate a draft's text to a target language via OpenAI. Returns
 * the translated text WITHOUT saving it — the agent reviews it and
 * saves it explicitly with saveTranslatedDraft(). The original draft
 * is never overwritten.
 */
export async function translateAiDraft(
  draftId: string,
  targetLanguage: string,
): Promise<ActionResult<{ translatedText: string; targetLanguage: string }>> {
  if (!isAiConfigured()) return fail(getAiNotConfiguredError());
  if (!isLanguage(targetLanguage)) {
    return fail("Choose a supported language (en, de, fr, it).");
  }

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const draft = await loadDraft(context.workspaceId, draftId);
  if (!draft) return fail("AI draft not found in this workspace.");
  if (draft.language === targetLanguage) {
    return fail("The draft is already in that language.");
  }

  const { system, user } = buildTranslatePrompt(draft.body, targetLanguage);
  const { data, error: aiError } = await chatCompletion([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
  if (aiError || !data) return fail(aiError ?? "The AI returned no translation.");

  return ok({ translatedText: data, targetLanguage });
}

/**
 * Save a reviewed translation as a NEW AI draft in the same
 * conversation. The original draft is kept untouched.
 */
export async function saveTranslatedDraft(
  draftId: string,
  targetLanguage: string,
  translatedText: string,
): Promise<ActionResult<{ draftId: string }>> {
  const text = translatedText.trim();
  if (!text) return fail("Nothing to save — the translation is empty.");
  if (text.length > 10000) return fail("Translation is too long (max 10,000 characters).");
  if (!isLanguage(targetLanguage)) {
    return fail("Choose a supported language (en, de, fr, it).");
  }

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const draft = await loadDraft(context.workspaceId, draftId);
  if (!draft) return fail("AI draft not found in this workspace.");

  const supabase = await createClient();
  const { data: inserted, error: insertError } = await supabase
    .from("messages")
    .insert({
      conversation_id: draft.conversation_id,
      workspace_id: context.workspaceId,
      sender_type: "ai",
      body: text,
      language: targetLanguage,
      is_ai_draft: true,
    })
    .select("id")
    .single();
  if (insertError || !inserted) {
    return fail(insertError?.message ?? "Could not save the translated draft.");
  }

  revalidateConversation(draft.conversation_id);
  return ok({ draftId: (inserted as { id: string }).id });
}

// ---------------------------------------------------------------------------
// Summarization
// ---------------------------------------------------------------------------

/**
 * Summarize a conversation's latest ~20 messages via OpenAI and store
 * the summary as a system message starting with "[AI summary]"
 * (internal note, team-only, visible in the thread like other internal
 * notes). Any previous "[AI summary]" message for the conversation is
 * deleted first, so there is at most one current summary. No schema
 * change is needed for this.
 */
export async function summarizeConversation(
  conversationId: string,
): Promise<ActionResult<{ summary: string }>> {
  if (!isAiConfigured()) return fail(getAiNotConfiguredError());

  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const { data: conversation, error: convError } = await getConversationById(
    context.workspaceId,
    conversationId,
  );
  if (convError || !conversation) {
    return fail(convError ?? "Conversation not found in this workspace.");
  }

  const { data: messages, error: messagesError } = await getMessages(
    context.workspaceId,
    conversationId,
  );
  if (messagesError) return fail(messagesError);
  if (messages.length === 0) {
    return fail("There is nothing to summarize yet.");
  }

  const recent = messages
    .slice(-20)
    .map((m) => ({ sender_type: m.sender_type, body: m.body }));
  const { system, user } = buildSummarizePrompt(recent);

  const { data, error: aiError } = await chatCompletion(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { maxTokens: 400 },
  );
  if (aiError || !data) return fail(aiError ?? "The AI returned no summary.");

  const summary = `${AI_SUMMARY_PREFIX} ${data}`;
  const supabase = await createClient();

  // Delete the previous summary first (at most one current summary).
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("conversation_id", conversationId)
    .eq("sender_type", "system")
    .like("body", `${AI_SUMMARY_PREFIX}%`);
  if (deleteError) return fail(deleteError.message);

  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    workspace_id: context.workspaceId,
    sender_type: "system",
    sender_id: context.user.id,
    body: summary,
    language: "en",
    is_ai_draft: false,
  });
  if (insertError) return fail(insertError.message);

  revalidateConversation(conversationId);
  return ok({ summary });
}

// ---------------------------------------------------------------------------
// Draft review: approve / discard
// ---------------------------------------------------------------------------

/**
 * Approve an AI draft (optionally with agent-edited text). The final
 * text becomes an agent message in the conversation (sender_type
 * 'agent', is_ai_draft false) — i.e. the saved agent reply, visible to
 * the visitor on their next widget poll for chat. The draft row is
 * deleted in the same action, so it cannot be approved twice. Nothing
 * is sent to an external channel here; email sending arrives in
 * Phase 5.
 */
export async function approveAiDraft(
  draftId: string,
  editedBody?: string,
): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const draft = await loadDraft(context.workspaceId, draftId);
  if (!draft) {
    return fail("AI draft not found in this workspace (it may already have been approved or discarded).");
  }

  const finalText = (editedBody ?? draft.body).trim();
  if (!finalText) return fail("The approved reply cannot be empty.");
  if (finalText.length > 10000) return fail("Reply is too long (max 10,000 characters).");

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("messages").insert({
    conversation_id: draft.conversation_id,
    workspace_id: context.workspaceId,
    sender_type: "agent",
    sender_id: context.user.id,
    body: finalText,
    language: draft.language ?? "en",
    is_ai_draft: false,
  });
  if (insertError) return fail(insertError.message);

  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", draftId)
    .eq("is_ai_draft", true);
  if (deleteError) return fail(deleteError.message);

  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("workspace_id", context.workspaceId)
    .eq("id", draft.conversation_id);

  revalidateConversation(draft.conversation_id);
  return ok(null);
}

/** Delete an AI draft without approving it. */
export async function discardAiDraft(draftId: string): Promise<ActionResult> {
  const { context, error } = await requireWorkspace();
  if (!context) return fail(error);

  const draft = await loadDraft(context.workspaceId, draftId);
  if (!draft) return fail("AI draft not found in this workspace.");

  const supabase = await createClient();
  const { error: deleteError } = await supabase
    .from("messages")
    .delete()
    .eq("workspace_id", context.workspaceId)
    .eq("id", draftId)
    .eq("is_ai_draft", true);
  if (deleteError) return fail(deleteError.message);

  revalidateConversation(draft.conversation_id);
  return ok(null);
}

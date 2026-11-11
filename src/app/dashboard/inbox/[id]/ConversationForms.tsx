"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  updateConversationStatus,
  assignConversation,
  addConversationMessage,
} from "@/lib/actions";
import { generateAiDraft, summarizeConversation } from "@/lib/ai-actions";

const STATUSES = ["open", "pending", "resolved"] as const;

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </p>
  );
}

function SuccessNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="mt-2 rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
      {message}
    </p>
  );
}

/** Change the conversation status (open → pending → resolved). */
export function StatusForm({
  conversationId,
  currentStatus,
}: {
  conversationId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === currentStatus) return;
    setSaving(true);
    setError(null);
    const result = await updateConversationStatus(conversationId, status);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="conversation-status" className="sr-only">
        Status
      </label>
      <select
        id="conversation-status"
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        {STATUSES.map((value) => (
          <option key={value} value={value}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" loading={saving} disabled={status === currentStatus}>
        Update
      </Button>
      <ErrorNote message={error} />
    </form>
  );
}

/** Assign the conversation to a workspace member (or unassign it). */
export function AssignForm({
  conversationId,
  members,
  assignedTo,
}: {
  conversationId: string;
  members: { userId: string; label: string }[];
  assignedTo: string | null;
}) {
  const router = useRouter();
  const [assignee, setAssignee] = useState(assignedTo ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    const result = await assignConversation(conversationId, assignee || null);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(assignee ? "Assigned." : "Unassigned.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="conversation-assignee" className="sr-only">
        Assign to
      </label>
      <select
        id="conversation-assignee"
        value={assignee}
        onChange={(event) => setAssignee(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" loading={saving}>
        Assign
      </Button>
      <ErrorNote message={error} />
      <SuccessNote message={saved} />
    </form>
  );
}

function MessageForm({
  conversationId,
  kind,
  title,
  description,
  placeholder,
  submitLabel,
  successMessage,
  channel,
}: {
  conversationId: string;
  kind: "reply" | "note";
  title: string;
  description: string;
  placeholder: string;
  submitLabel: string;
  successMessage: string;
  /** "email" when this is an email conversation — the reply may be sent via the provider. */
  channel?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    const result = await addConversationMessage(conversationId, body, kind);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setBody("");
    // Phase 5: an email reply reports honestly whether the provider
    // actually sent it — never claim a send that did not happen.
    if (kind === "reply" && channel === "email" && result.data) {
      setSaved(
        result.data.sentVia
          ? `Sent via ${result.data.sentVia === "gmail" ? "Gmail" : "Microsoft"}.`
          : "Saved to thread — not sent (no email provider connected, or the send failed).",
      );
    } else {
      setSaved(successMessage);
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{description}</p>
      <label htmlFor={`message-${kind}`} className="sr-only">
        {title}
      </label>
      <textarea
        id={`message-${kind}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        rows={4}
        required
        maxLength={10000}
        className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" loading={saving} disabled={!body.trim()}>
          {submitLabel}
        </Button>
        <span className="text-xs text-gray-400">{body.length}/10,000</span>
      </div>
      <ErrorNote message={error} />
      <SuccessNote message={saved} />
    </form>
  );
}

/** Agent reply — sent via the connected email provider for email conversations, otherwise saved to the thread only. */
export function ReplyForm({
  conversationId,
  channel,
}: {
  conversationId: string;
  channel?: string;
}) {
  const isEmail = channel === "email";
  return (
    <MessageForm
      conversationId={conversationId}
      kind="reply"
      channel={channel}
      title="Reply"
      description={
        isEmail
          ? "If a Gmail or Microsoft account is connected, this reply is sent by email. Otherwise it is saved to the thread only — the result below says which happened."
          : "The visitor sees this reply in the chat widget the next time it checks for new messages (it polls while open)."
      }
      placeholder="Write your reply to the customer…"
      submitLabel="Send reply"
      successMessage={
        isEmail
          ? "Reply saved to the thread."
          : "Reply saved — the visitor will see it in the chat widget."
      }
    />
  );
}

/** Internal note — visible only to your team, never to the customer. */
export function NoteForm({ conversationId }: { conversationId: string }) {
  return (
    <MessageForm
      conversationId={conversationId}
      kind="note"
      title="Internal note"
      description="Only your team can see this note. It never appears in customer-facing messages."
      placeholder="Add a note for your team…"
      submitLabel="Save note"
      successMessage="Internal note saved."
    />
  );
}

// ---------------------------------------------------------------------------
// Phase 4 — AI actions (generate draft, summarize)
// ---------------------------------------------------------------------------

/**
 * AI tools for one conversation. Both buttons are disabled with an
 * explanatory note while the OpenAI key is missing — the actions
 * themselves fail with the same honest error, so the UI can never
 * pretend AI ran.
 */
export function AiActions({
  conversationId,
  aiConfigured,
}: {
  conversationId: string;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"draft" | "summary" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const runDraft = async () => {
    setBusy("draft");
    setError(null);
    setSaved(null);
    const result = await generateAiDraft(conversationId);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved("AI draft saved to the thread — review it below before approving.");
    router.refresh();
  };

  const runSummary = async () => {
    setBusy("summary");
    setError(null);
    setSaved(null);
    const result = await summarizeConversation(conversationId);
    setBusy(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved("AI summary saved as an internal note in the thread.");
    router.refresh();
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-medium">AI Assistant</h2>
      <p className="mt-1 text-sm text-gray-500">
        Drafts are grounded in your published knowledge-base articles and
        always need a human&apos;s approval before they are used. Summaries
        are saved as internal notes, labelled AI-generated.
      </p>
      {!aiConfigured ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          AI is not configured — add your OpenAI API key to enable AI
          drafting and summaries.
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={runDraft}
          loading={busy === "draft"}
          disabled={!aiConfigured || busy !== null}
        >
          Generate AI draft
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={runSummary}
          loading={busy === "summary"}
          disabled={!aiConfigured || busy !== null}
        >
          Summarize
        </Button>
      </div>
      <ErrorNote message={error} />
      <SuccessNote message={saved} />
    </div>
  );
}

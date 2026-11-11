"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import {
  updateConversationStatus,
  assignConversation,
  addConversationMessage,
} from "@/lib/actions";

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
}: {
  conversationId: string;
  kind: "reply" | "note";
  title: string;
  description: string;
  placeholder: string;
  submitLabel: string;
  successMessage: string;
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
    setSaved(successMessage);
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

/** Agent reply — saved to the thread, not sent to the customer yet. */
export function ReplyForm({ conversationId }: { conversationId: string }) {
  return (
    <MessageForm
      conversationId={conversationId}
      kind="reply"
      title="Reply"
      description="Saved to this thread in LinguaDesk. It is not sent to the customer yet — sending channels (chat widget, email) arrive in later phases."
      placeholder="Write your reply to the customer…"
      submitLabel="Save reply"
      successMessage="Reply saved to the thread."
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

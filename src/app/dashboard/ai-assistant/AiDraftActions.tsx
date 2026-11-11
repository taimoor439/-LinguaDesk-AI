"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Badge } from "@/components/ui";
import {
  approveAiDraft,
  discardAiDraft,
  translateAiDraft,
  saveTranslatedDraft,
  summarizeConversation,
} from "@/lib/ai-actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German (Deutsch)" },
  { value: "fr", label: "French (Français)" },
  { value: "it", label: "Italian (Italiano)" },
] as const;

export interface DraftCardData {
  id: string;
  conversationId: string;
  subject: string | null;
  body: string;
  language: string | null;
  createdAt: string;
}

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

/**
 * One pending AI draft: approve / edit-then-approve / discard, plus
 * translation and a conversation summary.
 *
 * APPROVE stores the final text as an agent message in the thread
 * (saved reply, visible to the visitor on their next widget poll for
 * chat) and deletes the draft, so it cannot be approved twice. Nothing
 * here sends an email — email sending arrives in Phase 5.
 */
export function DraftCard({
  draft,
  aiConfigured,
}: {
  draft: DraftCardData;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [editedBody, setEditedBody] = useState(draft.body);
  const [editing, setEditing] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>(
    LANGUAGES.find((l) => l.value !== (draft.language ?? "en"))?.value ?? "en",
  );
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const run = async (key: string, fn: () => Promise<{ error: string | null }>) => {
    setBusy(key);
    setError(null);
    setSaved(null);
    const result = await fn();
    setBusy(null);
    return result;
  };

  const handleApprove = async () => {
    const result = await run("approve", () =>
      approveAiDraft(draft.id, editing ? editedBody : undefined),
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved("Approved — saved as an agent reply in the conversation.");
    router.refresh();
  };

  const handleDiscard = async () => {
    const result = await run("discard", () => discardAiDraft(draft.id));
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  };

  const handleTranslate = async () => {
    const result = await run("translate", async () => {
      const res = await translateAiDraft(draft.id, targetLanguage);
      if (res.error) return { error: res.error };
      setTranslatedText(res.data?.translatedText ?? "");
      return { error: null };
    });
    if (result.error) setError(result.error);
  };

  const handleSaveTranslation = async () => {
    if (!translatedText) return;
    const result = await run("save-translation", () =>
      saveTranslatedDraft(draft.id, targetLanguage, translatedText),
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setTranslatedText(null);
    setSaved("Translation saved as a new AI draft in the same conversation.");
    router.refresh();
  };

  const handleSummarize = async () => {
    const result = await run("summarize", () =>
      summarizeConversation(draft.conversationId),
    );
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved("AI summary saved as an internal note in the conversation.");
    router.refresh();
  };

  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/inbox/${draft.conversationId}`}
          className="font-medium text-teal-700 hover:underline"
        >
          {draft.subject ?? "Untitled conversation"}
        </Link>
        <Badge>AI draft</Badge>
        {draft.language ? <Badge>{draft.language}</Badge> : null}
        <span className="ml-auto text-sm text-gray-500">
          {new Date(draft.createdAt).toLocaleString()}
        </span>
      </div>

      {editing ? (
        <textarea
          value={editedBody}
          onChange={(event) => setEditedBody(event.target.value)}
          rows={5}
          maxLength={10000}
          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          aria-label="Edit draft text"
        />
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{draft.body}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={handleApprove}
          loading={busy === "approve"}
          disabled={busy !== null || (editing && !editedBody.trim())}
        >
          Approve{editing ? " edited draft" : ""}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setEditing((value) => !value);
            if (editing) setEditedBody(draft.body);
          }}
          disabled={busy !== null}
        >
          {editing ? "Cancel edit" : "Edit"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={handleDiscard}
          loading={busy === "discard"}
          disabled={busy !== null}
        >
          Discard
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={handleSummarize}
          loading={busy === "summarize"}
          disabled={busy !== null || !aiConfigured}
          title={
            aiConfigured
              ? "Summarize this conversation (AI-generated internal note)"
              : "AI is not configured — add your OpenAI API key"
          }
        >
          Summarize conversation
        </Button>
      </div>
      <ErrorNote message={error} />
      <SuccessNote message={saved} />

      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <h3 className="text-sm font-medium">Translate this draft</h3>
        <p className="mt-1 text-xs text-gray-500">
          The translation is shown for review first. Saving it creates a
          new AI draft — the original is never overwritten.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label htmlFor={`translate-${draft.id}`} className="sr-only">
            Translate to
          </label>
          <select
            id={`translate-${draft.id}`}
            value={targetLanguage}
            onChange={(event) => {
              setTargetLanguage(event.target.value);
              setTranslatedText(null);
            }}
            disabled={!aiConfigured || busy !== null}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {LANGUAGES.filter((l) => l.value !== (draft.language ?? "en")).map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleTranslate}
            loading={busy === "translate"}
            disabled={!aiConfigured || busy !== null}
            title={
              aiConfigured
                ? undefined
                : "AI is not configured — add your OpenAI API key"
            }
          >
            Translate
          </Button>
          {!aiConfigured ? (
            <span className="text-xs text-amber-700">
              AI is not configured — add your OpenAI API key.
            </span>
          ) : null}
        </div>
        {translatedText !== null ? (
          <div className="mt-3">
            <p className="whitespace-pre-wrap text-sm text-gray-700">{translatedText}</p>
            <div className="mt-2">
              <Button
                size="sm"
                onClick={handleSaveTranslation}
                loading={busy === "save-translation"}
                disabled={busy !== null}
              >
                Save as new draft
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </li>
  );
}

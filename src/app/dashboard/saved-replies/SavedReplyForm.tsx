"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createSavedReply, updateSavedReply } from "@/lib/actions";
import type { SavedReplyInput } from "@/lib/actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German (Deutsch)" },
  { value: "fr", label: "French (Français)" },
  { value: "it", label: "Italian (Italiano)" },
] as const;

/**
 * Create / edit form for one saved reply. Navigates back to the list
 * after a successful save.
 */
export default function SavedReplyForm({
  replyId,
  initial,
  submitLabel,
}: {
  /** When set, the form edits this reply; otherwise it creates one. */
  replyId?: string;
  initial: { title: string; body: string; language: string };
  submitLabel: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [language, setLanguage] = useState(initial.language);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: SavedReplyInput = { title, body, language };
    const result = replyId
      ? await updateSavedReply(replyId, input)
      : await createSavedReply(input);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }
    router.push("/dashboard/saved-replies");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <Input
        label="Title"
        name="title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="e.g. Shipping delay apology"
        required
      />
      <div>
        <label htmlFor="reply-language" className="mb-1 block text-sm font-medium text-slate-700">
          Language
        </label>
        <select
          id="reply-language"
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-sm text-slate-500">
          The language this reply is written in, so agents can match it to
          the customer&apos;s language.
        </p>
      </div>
      <div>
        <label htmlFor="reply-body" className="mb-1 block text-sm font-medium text-slate-700">
          Reply text
        </label>
        <textarea
          id="reply-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write the reusable reply…"
          rows={6}
          required
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" loading={saving}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

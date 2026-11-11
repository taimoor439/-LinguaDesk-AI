"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createContact, updateContact } from "@/lib/actions";
import type { ContactInput } from "@/lib/actions";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German (Deutsch)" },
  { value: "fr", label: "French (Français)" },
  { value: "it", label: "Italian (Italiano)" },
] as const;

const CHANNELS = ["", "chat", "email", "whatsapp"] as const;

export type ContactFormValues = {
  name: string;
  email: string;
  phone: string;
  preferred_language: string;
  channel: string;
  notes: string;
};

/**
 * Create / edit form for one contact. Calls the matching server action
 * and navigates to the contact detail page (create) or back to it (edit).
 */
export default function ContactForm({
  contactId,
  initial,
  submitLabel,
}: {
  /** When set, the form edits this contact; otherwise it creates one. */
  contactId?: string;
  initial: ContactFormValues;
  submitLabel: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<ContactFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof ContactFormValues) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setValues((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const input: ContactInput = {
      name: values.name.trim() || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      preferred_language: values.preferred_language,
      channel: values.channel || null,
      notes: values.notes.trim() || null,
    };

    const result = contactId
      ? await updateContact(contactId, input)
      : await createContact(input);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    if (contactId) {
      router.push(`/dashboard/contacts/${contactId}`);
    } else if (result.data && "id" in result.data) {
      router.push(`/dashboard/contacts/${result.data.id}`);
    } else {
      router.push("/dashboard/contacts");
    }
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <Input
        label="Name"
        name="name"
        value={values.name}
        onChange={set("name")}
        placeholder="e.g. Anna Müller"
        autoComplete="name"
      />
      <Input
        label="Email"
        name="email"
        type="email"
        value={values.email}
        onChange={set("email")}
        placeholder="anna@company.com"
        autoComplete="email"
      />
      <Input
        label="Phone"
        name="phone"
        type="tel"
        value={values.phone}
        onChange={set("phone")}
        placeholder="+49 …"
        autoComplete="tel"
      />
      <div>
        <label htmlFor="preferred_language" className="mb-1 block text-sm font-medium text-slate-700">
          Preferred language
        </label>
        <select
          id="preferred_language"
          name="preferred_language"
          value={values.preferred_language}
          onChange={set("preferred_language")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="channel" className="mb-1 block text-sm font-medium text-slate-700">
          Channel
        </label>
        <select
          id="channel"
          name="channel"
          value={values.channel}
          onChange={set("channel")}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel === "" ? "Not set" : channel}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="notes" className="mb-1 block text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          value={values.notes}
          onChange={set("notes")}
          placeholder="Anything your team should know about this contact…"
          rows={3}
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

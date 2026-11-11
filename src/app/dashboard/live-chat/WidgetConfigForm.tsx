"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { upsertWidgetConfig } from "@/lib/actions";
import { DICTIONARIES, getStoredLocale, type Locale } from "@/lib/i18n";
import type { WidgetConfigRow } from "@/lib/db";

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

/** Edit the workspace's widget config (creates the row if none exists). */
export function WidgetConfigForm({
  widget,
  aiConfigured,
}: {
  widget: WidgetConfigRow | null;
  /** True when an AI key is configured for the active provider. */
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("en");

  const [name, setName] = useState(widget?.name ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(widget?.welcome_message ?? "");
  const [greetingMessage, setGreetingMessage] = useState(widget?.greeting_message ?? "");
  const [brandColor, setBrandColor] = useState(widget?.brand_color ?? "#0D9488");
  const [position, setPosition] = useState(widget?.position ?? "bottom-right");
  const [collectName, setCollectName] = useState(widget?.collect_name ?? true);
  const [collectEmail, setCollectEmail] = useState(widget?.collect_email ?? true);
  const [aiAutoReply, setAiAutoReply] = useState(widget?.ai_auto_reply ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    setLocale(getStoredLocale());
    const onChange = (event: Event) => {
      const detail = (event as CustomEvent<Locale>).detail;
      if (detail) setLocale(detail);
    };
    window.addEventListener("linguadesk:locale-change", onChange);
    return () => window.removeEventListener("linguadesk:locale-change", onChange);
  }, []);

  const dict = DICTIONARIES[locale];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(null);
    const result = await upsertWidgetConfig({
      name: name.trim() || null,
      welcome_message: welcomeMessage.trim() || null,
      brand_color: brandColor,
      position,
      collect_name: collectName,
      collect_email: collectEmail,
      greeting_message: greetingMessage.trim() || null,
      ai_auto_reply: aiAutoReply,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved("Widget settings saved.");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="widget-name" className="mb-1 block text-sm font-medium">
            {dict.widgetName}
          </label>
          <Input
            id="widget-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Chat with us"
            maxLength={200}
          />
        </div>
        <div>
          <label htmlFor="widget-brand-color" className="mb-1 block text-sm font-medium">
            {dict.brandColor}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="widget-brand-color-picker"
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(brandColor) ? brandColor : "#0D9488"}
              onChange={(event) => setBrandColor(event.target.value)}
              className="h-10 w-12 cursor-pointer rounded-md border border-gray-300 bg-white p-1"
              aria-label="Pick a brand colour"
            />
            <Input
              id="widget-brand-color"
              value={brandColor}
              onChange={(event) => setBrandColor(event.target.value)}
              placeholder="#0D9488"
              maxLength={7}
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="widget-welcome" className="mb-1 block text-sm font-medium">
          {dict.welcomeMessage}
        </label>
        <textarea
          id="widget-welcome"
          value={welcomeMessage}
          onChange={(event) => setWelcomeMessage(event.target.value)}
          placeholder="Hi! How can we help you today?"
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label htmlFor="widget-greeting" className="mb-1 block text-sm font-medium">
          {dict.greetingMessage}
        </label>
        <textarea
          id="widget-greeting"
          value={greetingMessage}
          onChange={(event) => setGreetingMessage(event.target.value)}
          placeholder="Shown when a visitor opens the chat."
          rows={2}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="widget-position" className="mb-1 block text-sm font-medium">
            {dict.widgetPosition}
          </label>
          <select
            id="widget-position"
            value={position}
            onChange={(event) => setPosition(event.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={collectName}
            onChange={(event) => setCollectName(event.target.checked)}
            className="h-4 w-4"
          />
          {dict.collectName}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={collectEmail}
            onChange={(event) => setCollectEmail(event.target.checked)}
            className="h-4 w-4"
          />
          {dict.collectEmail}
        </label>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={aiAutoReply}
            onChange={(event) => setAiAutoReply(event.target.checked)}
            className="h-4 w-4"
          />
          AI auto-reply
        </label>
        <p className="mt-2 text-sm text-gray-500">
          When on, the AI answers new visitor messages automatically, using
          only your published Knowledge Base. Needs an AI key configured
          (Gemini/OpenAI). You can turn it off anytime.
        </p>
        {!aiConfigured && (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            AI is not configured yet — add your Gemini or OpenAI key to the
            deployment environment before turning this on. The setting will
            save, but no auto-replies will be sent until then.
          </p>
        )}
      </div>

      <Button type="submit" loading={saving}>
        {dict.saveWidgetConfig}
      </Button>
      <ErrorNote message={error} />
      <SuccessNote message={saved} />
    </form>
  );
}

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { createClient } from "@/lib/supabase/server";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getWorkspace,
  getWorkspaceSettings,
  getEmailAccounts,
} from "@/lib/db";

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "de", label: "German (Deutsch)" },
  { value: "fr", label: "French (Français)" },
  { value: "it", label: "Italian (Italiano)" },
] as const;

async function updateSettings(formData: FormData) {
  "use server";

  const { data: workspaceId } = await getCurrentWorkspaceId();
  if (!workspaceId) return;

  const defaultLanguage = String(formData.get("default_language") ?? "en");
  const aiEnabled = formData.get("ai_enabled") === "on";
  const aiAutoDraft = formData.get("ai_auto_draft") === "on";
  const retentionRaw = Number(formData.get("data_retention_days") ?? 365);
  const dataRetentionDays = Number.isFinite(retentionRaw) && retentionRaw > 0 ? retentionRaw : 365;

  const supabase = await createClient();
  await supabase.from("workspace_settings").upsert(
    {
      workspace_id: workspaceId,
      default_language: defaultLanguage,
      ai_enabled: aiEnabled,
      ai_auto_draft: aiAutoDraft,
      data_retention_days: dataRetentionDays,
    },
    { onConflict: "workspace_id" },
  );

  revalidatePath("/dashboard/settings");
}

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const openAiConfigured = Boolean(process.env.OPENAI_API_KEY);

  const { data: workspaceId } = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace yet"
        description="You are not a member of any workspace yet."
      />
    );
  }

  const [{ data: workspace }, { data: settings }, { data: accounts }] = await Promise.all([
    getWorkspace(workspaceId),
    getWorkspaceSettings(workspaceId),
    getEmailAccounts(workspaceId),
  ]);

  const gmail = accounts.find((a) => a.provider === "gmail");
  const microsoft = accounts.find((a) => a.provider === "microsoft");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Workspace</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">Name</dt>
            <dd>{workspace?.name ?? "—"}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">Slug</dt>
            <dd>{workspace?.slug ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Preferences</h2>
        <form action={updateSettings} className="mt-4 space-y-4">
          <div>
            <label htmlFor="default_language" className="block text-sm font-medium">
              Default language
            </label>
            <select
              id="default_language"
              name="default_language"
              defaultValue={settings?.default_language ?? "en"}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="ai_enabled"
              defaultChecked={settings?.ai_enabled ?? true}
              className="h-4 w-4"
            />
            AI assistant enabled
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="ai_auto_draft"
              defaultChecked={settings?.ai_auto_draft ?? true}
              className="h-4 w-4"
            />
            AI drafts replies automatically (human approval still required)
          </label>

          <div>
            <label htmlFor="data_retention_days" className="block text-sm font-medium">
              Data retention (days)
            </label>
            <input
              id="data_retention_days"
              type="number"
              name="data_retention_days"
              min={1}
              defaultValue={settings?.data_retention_days ?? 365}
              className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <button
            type="submit"
            className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Save settings
          </button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Environment status</h2>
        <p className="mt-1 text-sm text-gray-500">
          Connection status only — no secrets are shown here.
        </p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">Supabase</dt>
            <dd>
              <Badge>Connected</Badge>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">OpenAI</dt>
            <dd>
              <Badge>{openAiConfigured ? "Configured" : "Missing"}</Badge>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">Gmail</dt>
            <dd>
              <Badge>
                {gmail ? gmail.status : "Not configured"}
              </Badge>
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">Microsoft</dt>
            <dd>
              <Badge>
                {microsoft ? microsoft.status : "Not configured"}
              </Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

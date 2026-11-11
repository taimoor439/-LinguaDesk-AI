import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getAiDraftMessages } from "@/lib/db";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function AiAssistantPage() {
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

  const { data: drafts, error } = await getAiDraftMessages(workspaceId, 20);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">AI Assistant</h1>
      <p className="text-sm text-gray-500">
        The AI assistant drafts replies in the customer&apos;s language. Drafts
        are never sent automatically — a human always reviews and approves
        them first.
      </p>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Configuration</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">OpenAI API key</dt>
            <dd>
              <Badge>{openAiConfigured ? "Configured" : "Missing"}</Badge>
            </dd>
          </div>
        </dl>
        {!openAiConfigured ? (
          <p className="mt-3 text-sm text-gray-500">
            AI drafts require OPENAI_API_KEY to be set in the environment.
            Add it to your environment variables to enable AI drafting.
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Recent AI drafts</h2>
        {error ? (
          <p className="mt-4 text-sm text-red-600">Could not load drafts: {error}</p>
        ) : drafts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No AI drafts yet"
              description="AI-drafted replies will appear here once the assistant starts drafting. Every draft needs human approval before it is sent."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {drafts.map((message) => (
              <li key={message.id} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">
                    {message.conversations?.subject ?? "Untitled conversation"}
                  </span>
                  <Badge>AI draft</Badge>
                  {message.language ? <Badge>{message.language}</Badge> : null}
                  <span className="ml-auto text-sm text-gray-500">
                    {formatTime(message.created_at)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-700">{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

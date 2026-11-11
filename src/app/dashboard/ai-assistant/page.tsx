import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getAiDraftMessages } from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/openai";
import { DraftCard } from "./AiDraftActions";

export default async function AiAssistantPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const aiConfigured = isAiConfigured();

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
        The AI assistant drafts replies in the customer&apos;s language,
        grounded in your published knowledge-base articles. Drafts are
        never sent automatically — a human always reviews and approves
        them first.
      </p>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Configuration</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-40 text-gray-500">OpenAI API key</dt>
            <dd>
              <Badge>{aiConfigured ? "Configured" : "Missing"}</Badge>
            </dd>
          </div>
        </dl>
        {!aiConfigured ? (
          <p className="mt-3 text-sm text-gray-500">
            AI is not configured — add your OpenAI API key to your
            environment variables to enable AI drafting, translation and
            summaries. Generate, translate and summarize buttons stay
            disabled until then; nothing is faked.
          </p>
        ) : null}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Pending AI drafts</h2>
        <p className="mt-1 text-sm text-gray-500">
          Approving a draft saves it as an agent reply in the conversation
          (visible to the visitor on their next widget poll for chat). It
          does not send an email — email sending arrives in Phase 5.
        </p>
        {error ? (
          <p className="mt-4 text-sm text-red-600">Could not load drafts: {error}</p>
        ) : drafts.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No AI drafts yet"
              description="AI-drafted replies will appear here once the assistant starts drafting. Generate one from a conversation in the inbox. Every draft needs human approval before it is used."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {drafts.map((message) => (
              <DraftCard
                key={message.id}
                aiConfigured={aiConfigured}
                draft={{
                  id: message.id,
                  conversationId: message.conversation_id,
                  subject: message.conversations?.subject ?? null,
                  body: message.body,
                  language: message.language,
                  createdAt: message.created_at,
                }}
              />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getWidgetConfig,
  getConversations,
} from "@/lib/db";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function LiveChatPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const { data: workspaceId } = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace yet"
        description="You are not a member of any workspace yet."
      />
    );
  }

  const [{ data: widget }, { data: chats }] = await Promise.all([
    getWidgetConfig(workspaceId),
    getConversations(workspaceId, { channel: "chat", limit: 50 }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Website Live Chat</h1>
      <p className="text-sm text-gray-500">
        The embeddable chat widget lets visitors on your website start a
        conversation with your team or the AI assistant.
      </p>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Widget configuration</h2>
        {!widget ? (
          <div className="mt-4">
            <EmptyState
              title="No widget configured yet"
              description="Set up your chat widget in Settings to start receiving website chats."
            />
            <a
              href="/dashboard/settings"
              className="mt-3 inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Go to Settings
            </a>
          </div>
        ) : (
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Name</dt>
              <dd>{widget.name ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Welcome message</dt>
              <dd>{widget.welcome_message ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Brand colour</dt>
              <dd className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full border"
                  style={{ backgroundColor: widget.brand_color }}
                />
                {widget.brand_color}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Position</dt>
              <dd>{widget.position}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Collects name</dt>
              <dd>{widget.collect_name ? "Yes" : "No"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Collects email</dt>
              <dd>{widget.collect_email ? "Yes" : "No"}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Chat conversations</h2>
        {chats.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No chat conversations yet"
              description="Website chat conversations will appear here once visitors start chatting."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {chats.map((conversation) => (
              <li key={conversation.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {conversation.contacts?.name ??
                      conversation.contacts?.email ??
                      "Unknown contact"}
                  </p>
                  <p className="truncate text-sm text-gray-500">
                    {conversation.subject ?? "Untitled conversation"}
                  </p>
                </div>
                <span className="ml-auto flex flex-wrap items-center gap-2">
                  <Badge>{conversation.status}</Badge>
                  <Badge>{conversation.priority}</Badge>
                  <span className="text-sm text-gray-500">
                    {formatTime(conversation.last_message_at ?? conversation.created_at)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

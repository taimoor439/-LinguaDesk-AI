import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getDashboardStats,
  getRecentConversations,
} from "@/lib/db";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function OverviewPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired />;
  }

  const { data: workspaceId } = await getCurrentWorkspaceId();
  if (!workspaceId) {
    return (
      <EmptyState
        title="No workspace yet"
        description="You are not a member of any workspace yet. Create or join a workspace to see your dashboard."
      />
    );
  }

  const [{ data: stats }, { data: recent }] = await Promise.all([
    getDashboardStats(workspaceId),
    getRecentConversations(workspaceId, 5),
  ]);

  const statCards = [
    { label: "Total conversations", value: stats.totalConversations },
    { label: "Open", value: stats.openConversations },
    { label: "Resolved", value: stats.resolvedConversations },
    { label: "Contacts", value: stats.totalContacts },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold">{stat.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Recent conversations</h2>
        {recent.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No conversations yet"
              description="Conversations from chat, email, and WhatsApp will appear here once customers reach out."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {recent.map((conversation) => (
              <li key={conversation.id} className="flex flex-wrap items-center gap-2 py-3">
                <span className="font-medium">
                  {conversation.subject ?? "Untitled conversation"}
                </span>
                <Badge>{conversation.status}</Badge>
                <Badge>{conversation.channel}</Badge>
                <span className="ml-auto text-sm text-gray-500">
                  {formatTime(conversation.last_message_at ?? conversation.created_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-medium">Unified Inbox</h2>
          <p className="mt-1 text-sm text-gray-500">
            All customer conversations in one place.
          </p>
          <a
            href="/dashboard/inbox"
            className="mt-3 inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Open inbox
          </a>
        </Card>
        <Card className="p-4">
          <h2 className="text-lg font-medium">Knowledge Base</h2>
          <p className="mt-1 text-sm text-gray-500">
            Articles your AI assistant can use to answer customers.
          </p>
          <a
            href="/dashboard/knowledge-base"
            className="mt-3 inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            View knowledge base
          </a>
        </Card>
      </div>
    </div>
  );
}

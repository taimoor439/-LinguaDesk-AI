import Link from "next/link";
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

const QUICK_LINKS = [
  {
    href: "/dashboard/inbox",
    title: "Unified Inbox",
    description: "All customer conversations in one place — assign, reply and resolve.",
  },
  {
    href: "/dashboard/contacts",
    title: "Contacts",
    description: "Everyone your team talks to, with their conversation history.",
  },
  {
    href: "/dashboard/team",
    title: "Team Members",
    description: "Invite teammates and manage who can do what in this workspace.",
  },
  {
    href: "/dashboard/saved-replies",
    title: "Saved Replies",
    description: "Reusable answers in English, Deutsch, Français and Italiano.",
  },
];

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

  const [{ data: stats, error: statsError }, { data: recent, error: recentError }] =
    await Promise.all([
      getDashboardStats(workspaceId),
      getRecentConversations(workspaceId, 8),
    ]);

  const statCards = [
    { label: "Total conversations", value: stats.totalConversations },
    { label: "Open", value: stats.openConversations },
    { label: "Pending", value: stats.pendingConversations },
    { label: "Resolved", value: stats.resolvedConversations },
    { label: "Resolved in the last 7 days", value: stats.resolvedThisWeek },
    { label: "Unassigned", value: stats.unassignedConversations },
    { label: "Contacts", value: stats.totalContacts },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Overview</h1>

      {statsError || recentError ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">
            Could not load dashboard data: {statsError ?? recentError}
          </p>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className="mt-1 text-3xl font-semibold">{stat.value}</p>
          </Card>
        ))}
        <Card className="p-4">
          <p className="text-sm text-gray-500">Needs attention</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-700">
            {stats.openConversations + stats.pendingConversations === 0
              ? "Nothing waiting — every conversation is resolved or none have arrived yet."
              : `${stats.openConversations} open and ${stats.pendingConversations} pending conversations are waiting for your team.`}
          </p>
          <Link
            href="/dashboard/inbox"
            className="mt-2 inline-block text-sm font-medium text-teal-700 hover:underline"
          >
            Open inbox →
          </Link>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Recent conversations</h2>
          <Link
            href="/dashboard/inbox"
            className="text-sm font-medium text-teal-700 hover:underline"
          >
            View all →
          </Link>
        </div>
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
              <li key={conversation.id}>
                <Link
                  href={`/dashboard/inbox/${conversation.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg py-3 hover:bg-slate-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {conversation.contacts?.name ??
                        conversation.contacts?.email ??
                        "Unknown contact"}
                    </span>
                    <span className="block truncate text-sm text-gray-500">
                      {conversation.subject ?? "Untitled conversation"}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge>{conversation.status}</Badge>
                    <Badge>{conversation.channel}</Badge>
                    <span className="text-sm text-gray-500">
                      {formatTime(conversation.last_message_at ?? conversation.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK_LINKS.map((link) => (
          <Card key={link.href} className="p-4">
            <h2 className="text-lg font-medium">{link.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{link.description}</p>
            <Link
              href={link.href}
              className="mt-3 inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Open
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}

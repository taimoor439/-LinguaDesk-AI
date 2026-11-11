import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getConversations } from "@/lib/db";

const STATUSES = ["all", "open", "pending", "resolved"] as const;

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams?: { status?: string; q?: string };
}) {
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

  const statusParam = searchParams?.status ?? "all";
  const statusFilter =
    statusParam !== "all" && (STATUSES as readonly string[]).includes(statusParam)
      ? statusParam
      : undefined;
  const query = (searchParams?.q ?? "").trim().toLowerCase();

  const { data: conversations, error } = await getConversations(workspaceId, {
    status: statusFilter,
    limit: 50,
  });

  const visible = query
    ? conversations.filter((c) => {
        const haystack = `${c.subject ?? ""} ${c.contacts?.name ?? ""} ${
          c.contacts?.email ?? ""
        }`.toLowerCase();
        return haystack.includes(query);
      })
    : conversations;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Unified Inbox</h1>

      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          name="q"
          defaultValue={searchParams?.q ?? ""}
          placeholder="Search by subject or contact…"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {statusFilter ? <input type="hidden" name="status" value={statusFilter} /> : null}
        <button
          type="submit"
          className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((status) => {
          const active = statusParam === status;
          const href =
            status === "all"
              ? "/dashboard/inbox"
              : `/dashboard/inbox?status=${status}${query ? `&q=${encodeURIComponent(query)}` : ""}`;
          return (
            <a
              key={status}
              href={href}
              className={`rounded-full px-3 py-1 text-sm capitalize ${
                active
                  ? "bg-teal-600 font-medium text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status}
            </a>
          );
        })}
      </div>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">Could not load conversations: {error}</p>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No conversations yet"
            description={
              query || statusFilter
                ? "No conversations match the current search or filter."
                : "No conversations have arrived yet. New customer messages will appear here."
            }
          />
        </Card>
      ) : (
        <Card className="p-4">
          <ul className="divide-y divide-gray-100">
            {visible.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/dashboard/inbox/${conversation.id}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg py-3 hover:bg-slate-50"
                >
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
                    <Badge>{conversation.channel}</Badge>
                    <Badge>{conversation.status}</Badge>
                    <Badge>{conversation.priority}</Badge>
                    <span className="text-sm text-gray-500">
                      {formatTime(conversation.last_message_at ?? conversation.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

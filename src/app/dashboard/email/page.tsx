import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getEmailAccounts,
  getConversations,
} from "@/lib/db";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const PROVIDERS = ["gmail", "microsoft"] as const;

export default async function EmailPage() {
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

  const [{ data: accounts }, { data: emails }] = await Promise.all([
    getEmailAccounts(workspaceId),
    getConversations(workspaceId, { channel: "email", limit: 50 }),
  ]);

  const accountByProvider = new Map(accounts.map((a) => [a.provider, a]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Email</h1>
      <p className="text-sm text-gray-500">
        Connect a Gmail or Microsoft mailbox so incoming support emails land
        in your inbox.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {PROVIDERS.map((provider) => {
          const account = accountByProvider.get(provider);
          const connected = account?.status === "connected";
          return (
            <Card key={provider} className="p-4">
              <h2 className="text-lg font-medium capitalize">{provider}</h2>
              {account ? (
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex gap-2">
                    <dt className="w-24 text-gray-500">Account</dt>
                    <dd>{account.email ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 text-gray-500">Status</dt>
                    <dd>
                      <Badge>{account.status}</Badge>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-24 text-gray-500">Last sync</dt>
                    <dd>{formatTime(account.last_sync_at)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-gray-500">
                  {connected ? "" : `No ${provider} account connected yet.`}
                </p>
              )}
              {!connected ? (
                <p className="mt-3 text-sm text-gray-500">
                  Email account connection arrives in a later phase. Once
                  connected, incoming mail will appear below.
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>

      {accounts.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No email account connected"
            description="Connect a Gmail or Microsoft account to start receiving support emails here."
          />
        </Card>
      ) : null}

      <Card className="p-4">
        <h2 className="text-lg font-medium">Email conversations</h2>
        {emails.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No email conversations yet"
              description="Email conversations will appear here once a mailbox is connected and mail arrives."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {emails.map((conversation) => (
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

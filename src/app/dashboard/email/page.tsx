import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getEmailAccounts,
  getConversations,
} from "@/lib/db";
import {
  EMAIL_PROVIDERS,
  PROVIDER_LABELS,
  getEmailRedirectUri,
  getProviderEnvStatus,
} from "@/lib/email/config";
import { isEncryptionConfigured } from "@/lib/email/crypto";
import EmailActions from "./EmailActions";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function EmailPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
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

  const [{ data: accounts }, { data: emails }] = await Promise.all([
    getEmailAccounts(workspaceId),
    getConversations(workspaceId, { channel: "email", limit: 50 }),
  ]);

  const accountByProvider = new Map(accounts.map((a) => [a.provider, a]));
  const redirectUri = getEmailRedirectUri();
  const encryptionConfigured = isEncryptionConfigured();
  const connectedProvider =
    searchParams?.connected === "gmail" || searchParams?.connected === "microsoft"
      ? searchParams.connected
      : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Email</h1>
      <p className="text-sm text-gray-500">
        Connect a Gmail or Microsoft mailbox so incoming support emails land
        in your inbox. Sync is manual — use &ldquo;Sync now&rdquo; on a
        connected account. Replies to email conversations are sent via the
        connected provider when one is available; otherwise they are saved
        to the thread only.
      </p>

      {connectedProvider ? (
        <p role="status" className="rounded-md bg-teal-50 px-3 py-2 text-sm text-teal-800">
          {PROVIDER_LABELS[connectedProvider as "gmail" | "microsoft"]} connected
          successfully.
        </p>
      ) : null}
      {searchParams?.error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {searchParams.error}
        </p>
      ) : null}

      {!encryptionConfigured ? (
        <Card className="p-4">
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Token encryption is not configured — set TOKEN_ENCRYPTION_KEY
            (64 hex characters or 44 base64 characters) in .env.local.
            Connecting, syncing and sending are disabled until then, and no
            tokens are stored.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {EMAIL_PROVIDERS.map((provider) => {
          const account = accountByProvider.get(provider);
          const connected = account?.status === "connected";
          const envStatus = getProviderEnvStatus(provider);
          return (
            <Card key={provider} className="p-4">
              <h2 className="text-lg font-medium">{PROVIDER_LABELS[provider]}</h2>
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
                  No {PROVIDER_LABELS[provider]} account connected yet.
                </p>
              )}
              <EmailActions
                provider={provider}
                label={PROVIDER_LABELS[provider]}
                connected={connected}
                oauthConfigured={envStatus.configured}
                missingEnvVars={envStatus.missing}
                encryptionConfigured={encryptionConfigured}
              />
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Setup note</h2>
        <p className="mt-2 text-sm text-gray-500">
          When creating the OAuth client in the Google Cloud Console or the
          Microsoft Entra app registration, register this exact redirect
          URI:
        </p>
        <code className="mt-2 block break-all rounded-md bg-slate-100 px-3 py-2 text-sm">
          {redirectUri}
        </code>
        <p className="mt-2 text-sm text-gray-500">
          Gmail needs the gmail.readonly and gmail.send scopes; Microsoft
          needs Mail.Read, Mail.Send and offline_access. Until the OAuth
          clients exist (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET,
          MICROSOFT_CLIENT_ID / MICROSOFT_CLIENT_SECRET in .env.local),
          the connect buttons above stay disabled.
        </p>
      </Card>

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
              description="Email conversations will appear here once a mailbox is connected and synced."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {emails.map((conversation) => (
              <li key={conversation.id} className="flex flex-wrap items-center gap-2 py-3">
                <div className="min-w-0">
                  <Link
                    href={`/dashboard/inbox/${conversation.id}`}
                    className="truncate font-medium text-teal-700 hover:underline"
                  >
                    {conversation.contacts?.name ??
                      conversation.contacts?.email ??
                      "Unknown contact"}
                  </Link>
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

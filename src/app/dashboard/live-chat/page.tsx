import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getWidgetConfig,
  getConversations,
  getChatNeedsAttention,
} from "@/lib/db";
import { isAiConfigured } from "@/lib/ai/openai";
import { WidgetConfigForm } from "./WidgetConfigForm";
import { InstallSnippet } from "./InstallSnippet";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function conversationLabel(conversation: {
  contacts: { name: string | null; email: string | null } | null;
  subject: string | null;
}): string {
  return (
    conversation.contacts?.name ??
    conversation.contacts?.email ??
    conversation.subject ??
    "Unknown contact"
  );
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

  const [
    { data: widget },
    { data: chats },
    { data: attention },
  ] = await Promise.all([
    getWidgetConfig(workspaceId),
    getConversations(workspaceId, { channel: "chat", limit: 50 }),
    getChatNeedsAttention(workspaceId),
  ]);

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const scriptSrc = appUrl
    ? `${appUrl}/api/widget.js`
    : "/api/widget.js";
  const snippet = `<script src="${scriptSrc}" data-workspace="${workspaceId}"></script>`;

  const attentionItems = [
    ...attention.handoffs.map((c) => ({ conversation: c, reason: "Handoff requested" })),
    ...attention.unassigned
      .filter((c) => !attention.handoffs.some((h) => h.id === c.id))
      .map((c) => ({ conversation: c, reason: "Unassigned open chat" })),
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Website Live Chat</h1>
      <p className="text-sm text-gray-500">
        The embeddable chat widget lets visitors on your website start a
        conversation with your team. Agent replies you save in the inbox
        reach the visitor in the widget on its next poll.
      </p>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Widget configuration</h2>
        {widget && (
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
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">Greeting message</dt>
              <dd>{widget.greeting_message ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-40 text-gray-500">AI auto-reply</dt>
              <dd>{widget.ai_auto_reply ? "On" : "Off"}</dd>
            </div>
          </dl>
        )}
        {!widget && (
          <p className="mt-3 text-sm text-gray-500">
            No widget configured yet. Save the settings below to create one —
            the install snippet starts working once it exists.
          </p>
        )}
        <WidgetConfigForm widget={widget} aiConfigured={isAiConfigured()} />
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Install snippet</h2>
        <InstallSnippet
          snippet={snippet}
          hasConfig={Boolean(widget)}
          appUrlConfigured={Boolean(appUrl)}
        />
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">Needs attention</h2>
        <p className="mt-1 text-sm text-gray-500">
          Visitors who asked for a human agent, and open chats with nobody
          assigned. Open one to reply or assign it to a teammate.
        </p>
        {attentionItems.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="Nothing needs attention"
              description="No handoff requests and no unassigned open chats right now."
            />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100">
            {attentionItems.map(({ conversation, reason }) => (
              <li key={conversation.id} className="py-3">
                <Link
                  href={`/dashboard/inbox/${conversation.id}`}
                  className="flex flex-wrap items-center gap-2 hover:underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {conversationLabel(conversation)}
                    </span>
                    <span className="block truncate text-sm text-gray-500">
                      {reason} · {formatTime(conversation.last_message_at ?? conversation.created_at)}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
                    <Badge>{conversation.status}</Badge>
                    <Badge>{conversation.priority}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
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
              <li key={conversation.id} className="py-3">
                <Link
                  href={`/dashboard/inbox/${conversation.id}`}
                  className="flex flex-wrap items-center gap-2 hover:underline"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">
                      {conversationLabel(conversation)}
                    </span>
                    <span className="block truncate text-sm text-gray-500">
                      {conversation.subject ?? "Untitled conversation"}
                    </span>
                  </span>
                  <span className="ml-auto flex flex-wrap items-center gap-2">
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
        )}
      </Card>
    </div>
  );
}

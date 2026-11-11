import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getConversationById,
  getMessages,
  getTeamMembers,
} from "@/lib/db";
import {
  StatusForm,
  AssignForm,
  ReplyForm,
  NoteForm,
} from "./ConversationForms";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function statusVariant(status: string): "success" | "warning" | "info" | "default" {
  if (status === "resolved") return "success";
  if (status === "open") return "warning";
  if (status === "pending") return "info";
  return "default";
}

function priorityVariant(priority: string): "danger" | "warning" | "default" {
  if (priority === "urgent" || priority === "high") return "danger";
  if (priority === "low") return "default";
  return "warning";
}

export default async function ConversationDetailPage({
  params,
}: {
  params: { id: string };
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

  const [
    { data: conversation, error: conversationError },
    { data: messages, error: messagesError },
    { data: members },
  ] = await Promise.all([
    getConversationById(workspaceId, params.id),
    getMessages(workspaceId, params.id),
    getTeamMembers(workspaceId),
  ]);

  if (conversationError || messagesError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">
          Could not load this conversation: {conversationError ?? messagesError}
        </p>
        <Link
          href="/dashboard/inbox"
          className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to inbox
        </Link>
      </Card>
    );
  }

  if (!conversation) {
    return (
      <EmptyState
        title="Conversation not found"
        description="It may have been deleted, or it belongs to a different workspace."
        action={
          <Link
            href="/dashboard/inbox"
            className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Back to inbox
          </Link>
        }
      />
    );
  }

  const contactName =
    conversation.contacts?.name ?? conversation.contacts?.email ?? "Unknown contact";
  const assigneeName =
    conversation.assignee_name ??
    conversation.assignee_email ??
    (conversation.assigned_to ? "Assigned agent" : null);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/inbox"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to inbox
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {conversation.subject ?? "Untitled conversation"}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant={statusVariant(conversation.status)}>{conversation.status}</Badge>
          <Badge variant={priorityVariant(conversation.priority)}>
            {conversation.priority} priority
          </Badge>
          <Badge>{conversation.channel}</Badge>
          <Badge>{conversation.language}</Badge>
          <span className="text-sm text-gray-500">
            Started {formatTime(conversation.created_at)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-4">
            <h2 className="text-lg font-medium">Message thread</h2>
            {messages.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  title="No messages yet"
                  description="Messages in this conversation will appear here."
                />
              </div>
            ) : (
              <ul className="mt-4 space-y-4">
                {messages.map((message) => {
                  const isNote = message.sender_type === "system";
                  const isAgent = message.sender_type === "agent";
                  const isAi = message.sender_type === "ai";
                  const author = isNote
                    ? `Internal note${message.sender_name ? ` by ${message.sender_name}` : ""}`
                    : isAgent
                      ? (message.sender_name ?? message.sender_email ?? "Agent")
                      : isAi
                        ? "AI draft"
                        : contactName;
                  return (
                    <li
                      key={message.id}
                      className={`rounded-lg border p-4 ${
                        isNote
                          ? "border-amber-200 bg-amber-50"
                          : isAgent
                            ? "border-teal-100 bg-teal-50"
                            : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{author}</span>
                        {isNote ? (
                          <Badge variant="warning">Internal — team only</Badge>
                        ) : null}
                        {message.is_ai_draft ? (
                          <Badge variant="info">Draft — not sent</Badge>
                        ) : null}
                        <span className="ml-auto text-xs text-gray-500">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                        {message.body}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <ReplyForm conversationId={conversation.id} />
          <NoteForm conversationId={conversation.id} />
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <h2 className="text-lg font-medium">Contact</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex gap-2">
                <dt className="w-20 shrink-0 text-gray-500">Name</dt>
                <dd className="min-w-0 break-words">{contactName}</dd>
              </div>
              {conversation.contacts?.email ? (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Email</dt>
                  <dd className="min-w-0 break-words">{conversation.contacts.email}</dd>
                </div>
              ) : null}
              {conversation.contact_id ? (
                <div className="flex gap-2">
                  <dt className="w-20 shrink-0 text-gray-500">Profile</dt>
                  <dd>
                    <Link
                      href={`/dashboard/contacts/${conversation.contact_id}`}
                      className="font-medium text-teal-700 hover:underline"
                    >
                      View contact →
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-medium">Status</h2>
            <div className="mt-3">
              <StatusForm
                conversationId={conversation.id}
                currentStatus={conversation.status}
              />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-medium">Assigned to</h2>
            <p className="mt-1 text-sm text-gray-500">
              {assigneeName ?? "Nobody is assigned to this conversation yet."}
            </p>
            <div className="mt-3">
              <AssignForm
                conversationId={conversation.id}
                members={members.map((m) => ({
                  userId: m.user_id,
                  label: m.full_name ?? m.email ?? m.user_id,
                }))}
                assignedTo={conversation.assigned_to}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

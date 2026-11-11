import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import {
  getCurrentWorkspaceId,
  getContactById,
  getContactConversations,
} from "@/lib/db";
import { deleteContact } from "@/lib/actions";
import ConfirmButton from "@/components/ConfirmButton";

function formatTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

export default async function ContactDetailPage({
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
    { data: contact, error: contactError },
    { data: conversations, error: conversationsError },
  ] = await Promise.all([
    getContactById(workspaceId, params.id),
    getContactConversations(workspaceId, params.id),
  ]);

  if (contactError || conversationsError) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">
          Could not load this contact: {contactError ?? conversationsError}
        </p>
        <Link
          href="/dashboard/contacts"
          className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to contacts
        </Link>
      </Card>
    );
  }

  if (!contact) {
    return (
      <EmptyState
        title="Contact not found"
        description="It may have been deleted, or it belongs to a different workspace."
        action={
          <Link
            href="/dashboard/contacts"
            className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Back to contacts
          </Link>
        }
      />
    );
  }

  const deleteAction = deleteContact.bind(null, contact.id);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to contacts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{contact.name ?? "Unnamed contact"}</h1>
          <Badge>{contact.preferred_language}</Badge>
          {contact.channel ? <Badge>{contact.channel}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="text-lg font-medium">Details</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Email</dt>
              <dd className="min-w-0 break-words">{contact.email ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Phone</dt>
              <dd className="min-w-0 break-words">{contact.phone ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Preferred language</dt>
              <dd>{contact.preferred_language}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Channel</dt>
              <dd>{contact.channel ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Last interaction</dt>
              <dd>{formatTime(contact.last_interaction_at)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Added</dt>
              <dd>{formatTime(contact.created_at)}</dd>
            </div>
            {contact.notes ? (
              <div className="flex gap-2">
                <dt className="w-32 shrink-0 text-gray-500">Notes</dt>
                <dd className="whitespace-pre-wrap">{contact.notes}</dd>
              </div>
            ) : null}
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/dashboard/contacts/${contact.id}/edit`}
              className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Edit contact
            </Link>
            <ConfirmButton
              label="Delete contact"
              confirmTitle="Delete this contact?"
              confirmText="The contact will be permanently deleted. Their conversations stay in the inbox, but will no longer be linked to this contact."
              onConfirm={deleteAction}
              redirectTo="/dashboard/contacts"
            />
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="text-lg font-medium">
            Conversations ({conversations.length})
          </h2>
          {conversations.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No conversations yet"
                description="Conversations with this contact will appear here."
              />
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/dashboard/inbox/${conversation.id}`}
                    className="flex flex-wrap items-center gap-2 rounded-lg py-3 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {conversation.subject ?? "Untitled conversation"}
                      </span>
                      <span className="block text-sm text-gray-500">
                        {formatTime(conversation.last_message_at ?? conversation.created_at)}
                      </span>
                    </span>
                    <span className="ml-auto flex flex-wrap items-center gap-2">
                      <Badge>{conversation.channel}</Badge>
                      <Badge>{conversation.status}</Badge>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

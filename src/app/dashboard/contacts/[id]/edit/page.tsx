import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getContactById } from "@/lib/db";
import ContactForm from "../../ContactForm";

export default async function EditContactPage({
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

  const { data: contact, error } = await getContactById(workspaceId, params.id);

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">Could not load this contact: {error}</p>
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/dashboard/contacts/${contact.id}`}
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to contact
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          Edit {contact.name ?? "contact"}
        </h1>
      </div>
      <div className="max-w-2xl">
        <ContactForm
          contactId={contact.id}
          initial={{
            name: contact.name ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
            preferred_language: contact.preferred_language,
            channel: contact.channel ?? "",
            notes: contact.notes ?? "",
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}

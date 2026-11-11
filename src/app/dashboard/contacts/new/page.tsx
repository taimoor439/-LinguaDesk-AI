import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId } from "@/lib/db";
import ContactForm from "../ContactForm";

export default async function NewContactPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/contacts"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to contacts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New contact</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add at least a name, email or phone number.
        </p>
      </div>
      <div className="max-w-2xl">
        <ContactForm
          initial={{
            name: "",
            email: "",
            phone: "",
            preferred_language: "en",
            channel: "",
            notes: "",
          }}
          submitLabel="Create contact"
        />
      </div>
    </div>
  );
}

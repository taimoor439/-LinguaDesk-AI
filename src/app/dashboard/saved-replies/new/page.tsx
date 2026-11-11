import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId } from "@/lib/db";
import SavedReplyForm from "../SavedReplyForm";

export default async function NewSavedReplyPage() {
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
          href="/dashboard/saved-replies"
          className="text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to saved replies
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New saved reply</h1>
      </div>
      <div className="max-w-2xl">
        <SavedReplyForm
          initial={{ title: "", body: "", language: "en" }}
          submitLabel="Create saved reply"
        />
      </div>
    </div>
  );
}

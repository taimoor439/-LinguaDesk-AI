import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getSavedReplyById } from "@/lib/db";
import SavedReplyForm from "../../SavedReplyForm";

export default async function EditSavedReplyPage({
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

  const { data: reply, error } = await getSavedReplyById(workspaceId, params.id);

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">Could not load this saved reply: {error}</p>
        <Link
          href="/dashboard/saved-replies"
          className="mt-3 inline-block text-sm font-medium text-teal-700 hover:underline"
        >
          ← Back to saved replies
        </Link>
      </Card>
    );
  }

  if (!reply) {
    return (
      <EmptyState
        title="Saved reply not found"
        description="It may have been deleted, or it belongs to a different workspace."
        action={
          <Link
            href="/dashboard/saved-replies"
            className="inline-block rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
          >
            Back to saved replies
          </Link>
        }
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
        <h1 className="mt-2 text-2xl font-semibold">
          Edit {reply.title ?? "saved reply"}
        </h1>
      </div>
      <div className="max-w-2xl">
        <SavedReplyForm
          replyId={reply.id}
          initial={{
            title: reply.title ?? "",
            body: reply.body ?? "",
            language: reply.language,
          }}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}

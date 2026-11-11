import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, Badge, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getSavedReplies } from "@/lib/db";

export default async function SavedRepliesPage() {
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

  const { data: replies, error } = await getSavedReplies(workspaceId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Saved Replies</h1>
      <p className="text-sm text-gray-500">
        Reusable answers your team can send in one click, in each
        customer&apos;s language.
      </p>

      {error ? (
        <Card className="p-4">
          <p className="text-sm text-red-600">Could not load saved replies: {error}</p>
        </Card>
      ) : replies.length === 0 ? (
        <Card className="p-4">
          <EmptyState
            title="No saved replies yet"
            description="Saved replies you create will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {replies.map((reply) => (
            <Card key={reply.id} className="p-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-medium">{reply.title ?? "Untitled reply"}</h2>
                <Badge>{reply.language}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                {reply.body ?? ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupRequired from "@/components/SetupRequired";
import { Card, EmptyState } from "@/components/ui";
import { getCurrentWorkspaceId, getAnalytics } from "@/lib/db";

function CountTable({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; count: number }[];
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
  return (
    <Card className="p-4">
      <h2 className="text-lg font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No data yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-medium capitalize">{row.label}</span>
                <span className="text-gray-500">{row.count}</span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-teal-600"
                  style={{ width: max > 0 ? `${(row.count / max) * 100}%` : "0%" }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default async function AnalyticsPage() {
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

  const { data: analytics, error } = await getAnalytics(workspaceId);

  if (error) {
    return (
      <Card className="p-4">
        <p className="text-sm text-red-600">Could not load analytics: {error}</p>
      </Card>
    );
  }

  if (analytics.totalConversations === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <Card className="p-4">
          <EmptyState
            title="No data yet"
            description="Analytics appear once conversations exist. These numbers are computed from your real conversations only — nothing here is estimated or fabricated."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Analytics</h1>
      <p className="text-sm text-gray-500">
        Computed from your real conversations only.
      </p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total conversations</p>
          <p className="mt-1 text-3xl font-semibold">{analytics.totalConversations}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">Total messages</p>
          <p className="mt-1 text-3xl font-semibold">{analytics.totalMessages}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500">AI drafts</p>
          <p className="mt-1 text-3xl font-semibold">{analytics.aiDraftCount}</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <CountTable
          title="By status"
          rows={analytics.byStatus.map((r) => ({ label: r.status, count: r.count }))}
        />
        <CountTable
          title="By channel"
          rows={analytics.byChannel.map((r) => ({ label: r.channel, count: r.count }))}
        />
        <CountTable
          title="By language"
          rows={analytics.byLanguage.map((r) => ({ label: r.language, count: r.count }))}
        />
      </div>
    </div>
  );
}

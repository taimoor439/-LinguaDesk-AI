import type { NextRequest } from "next/server";
import {
  getWidgetAnonClient,
  isUuid,
  jsonResponse,
  errorResponse,
  optionsResponse,
} from "@/lib/widget-api";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return optionsResponse();
}

/**
 * GET /api/widget/config?workspace={uuid}
 * Public: returns the workspace's widget config, or 404 when there is
 * none. The config is public by design (migration 0003 grants anon
 * SELECT on widget_configs) — it is what a website owner embeds on
 * their own public site.
 */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspace");
  if (!isUuid(workspaceId)) {
    return errorResponse("A valid workspace id is required.", 400);
  }

  const supabase = getWidgetAnonClient();
  if (!supabase) {
    return errorResponse("Widget is not configured.", 500);
  }

  const { data, error } = await supabase
    .from("widget_configs")
    .select(
      "name, welcome_message, brand_color, position, collect_name, collect_email, greeting_message",
    )
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    console.error("widget config lookup failed:", error.message);
    return errorResponse("Could not load the widget configuration.", 500);
  }
  if (!data) {
    return errorResponse("No widget configured for this workspace.", 404);
  }

  return jsonResponse({ config: data });
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Activity keys stored in tab_view_marks (shared with markTabViewed). */
export const ACTIVITY_KEYS = { network: "provider_network", platformRequests: "platform_requests", adminPlatformRequests: "admin_platform_requests" } as const;
const EPOCH = "1970-01-01T00:00:00.000Z";

/**
 * Real-record activity counts for the Network and Platform Requests dots.
 * Every count runs as the signed-in user, so row-level rules decide what is
 * counted — nothing is fabricated and no other account's records leak.
 */
export const getActivityIndicators = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: marks } = await supabase.from("tab_view_marks").select("tab_key, last_viewed_at").eq("user_id", userId);
    const since = (k: string) => (marks ?? []).find((m) => m.tab_key === k)?.last_viewed_at ?? EPOCH;
    const count = async (q: PromiseLike<{ count: number | null }>) => { try { return (await q).count ?? 0; } catch { return 0; } };
    const [network, platformReplies, adminPlatform] = await Promise.all([
      count(supabase.from("provider_trip_offers").select("id", { count: "exact", head: true }).gt("created_at", since(ACTIVITY_KEYS.network))),
      count(supabase.from("platform_request_events").select("id", { count: "exact", head: true }).neq("actor_user_id", userId).gt("created_at", since(ACTIVITY_KEYS.platformRequests))),
      count(supabase.from("platform_requests").select("id", { count: "exact", head: true }).gt("created_at", since(ACTIVITY_KEYS.adminPlatformRequests))),
    ]);
    return { network, platformRequests: platformReplies, adminPlatformRequests: adminPlatform };
  });

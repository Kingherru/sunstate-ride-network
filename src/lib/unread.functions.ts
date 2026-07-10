import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Tab keys used across dashboards. Anyone who uses `markTabViewed` and
 * `getUnreadCounts` must use the same key strings.
 */
export const TAB_KEYS = {
  providerReservations: "provider_reservations",
  providerReferrals: "provider_referrals",
  facilitySent: "facility_sent",
  patientSent: "patient_sent",
  adminReservations: "admin_reservations",
  adminDispatch: "admin_dispatch",
  adminTrips: "admin_trips",
} as const;

export type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];

const EPOCH = "1970-01-01T00:00:00.000Z";

async function loadMarks(supabase: any, userId: string) {
  const { data } = await supabase
    .from("tab_view_marks")
    .select("tab_key, last_viewed_at")
    .eq("user_id", userId);
  const map: Record<string, string> = {};
  (data ?? []).forEach((r: any) => (map[r.tab_key] = r.last_viewed_at));
  return map;
}

async function countSince(
  supabase: any,
  table: "ride_requests" | "trips",
  since: string,
  filter: (q: any) => any,
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).gt("created_at", since);
  q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

/**
 * Return per-tab unread counts for the current user, scoped by role/RLS.
 * RLS on ride_requests + trips is our security boundary — we only ever
 * count rows the user can already see.
 */
export const getUnreadCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const marks = await loadMarks(supabase, userId);

    // Ops role detection
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    const isOps = roles.some((r) =>
      ["admin", "app_manager", "zone_manager", "dispatcher", "staff"].includes(r),
    );

    const counts: Partial<Record<TabKey, number>> = {};

    // Provider queues
    counts.provider_reservations = await countSince(
      supabase,
      "ride_requests",
      marks[TAB_KEYS.providerReservations] ?? EPOCH,
      (q) => q.eq("assigned_provider_id", userId),
    );
    counts.provider_referrals = await countSince(
      supabase,
      "trips",
      marks[TAB_KEYS.providerReferrals] ?? EPOCH,
      (q) => q.eq("assigned_to", userId),
    );

    // Facility / patient "sent" — updates to trips they created (surfaced as badge on Trip History)
    counts.facility_sent = await countSince(
      supabase,
      "trips",
      marks[TAB_KEYS.facilitySent] ?? EPOCH,
      (q) => q.eq("created_by", userId),
    );
    counts.patient_sent = await countSince(
      supabase,
      "ride_requests",
      marks[TAB_KEYS.patientSent] ?? EPOCH,
      (q) => q.eq("requester_user_id", userId),
    );

    // Admin / ops queues
    if (isOps) {
      counts.admin_reservations = await countSince(
        supabase,
        "ride_requests",
        marks[TAB_KEYS.adminReservations] ?? EPOCH,
        (q) => q,
      );
      counts.admin_dispatch = await countSince(
        supabase,
        "trips",
        marks[TAB_KEYS.adminDispatch] ?? EPOCH,
        (q) => q.in("status", ["open", "new", "pending"]),
      );
      counts.admin_trips = await countSince(
        supabase,
        "trips",
        marks[TAB_KEYS.adminTrips] ?? EPOCH,
        (q) => q,
      );
    }

    return { ok: true as const, counts };
  });

export const markTabViewed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ tab_key: z.string().min(1).max(60) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("tab_view_marks")
      .upsert(
        { user_id: userId, tab_key: data.tab_key, last_viewed_at: new Date().toISOString() },
        { onConflict: "user_id,tab_key" },
      );
    if (error) {
      console.error("markTabViewed error", error);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Universal notification badge keys used across every portal sidebar and
 * sub-tab. Anyone who calls `markTabViewed` and `getUnreadCounts` must use
 * the same key strings; the sidebar renderer looks up SEVERITY[key] to color
 * the badge (green = positive, yellow = attention, red = urgent).
 */
export const TAB_KEYS = {
  // Requester queues (patient / facility)
  patientSent: "patient_sent",
  facilitySent: "facility_sent",

  // Provider queues
  providerReservations: "provider_reservations",
  providerReferrals: "provider_referrals",
  providerPayments: "provider_payments",
  providerPayouts: "provider_payouts",
  providerMembership: "provider_membership",
  providerCompliance: "provider_compliance",
  providerDrivers: "provider_drivers",
  providerVehicles: "provider_vehicles",

  // Ops / admin
  adminReservations: "admin_reservations",
  adminDispatch: "admin_dispatch",
  adminTrips: "admin_trips",
  adminProviders: "admin_providers",
  adminPayouts: "admin_payouts",
} as const;

export type TabKey = (typeof TAB_KEYS)[keyof typeof TAB_KEYS];
export type Severity = "green" | "yellow" | "red";

/**
 * Static severity per tab key. Kept client-safe so the sidebar can color a
 * badge without a round-trip. Semantics follow the product spec:
 *   green  = positive update (new activity, completed action, successful payment)
 *   yellow = attention needed (review, missing info, upcoming action)
 *   red    = urgent problem (failed payment, expired doc, denied status)
 */
export const SEVERITY: Record<TabKey, Severity> = {
  patient_sent: "green",
  facility_sent: "green",
  provider_reservations: "green",
  provider_referrals: "yellow",
  provider_payments: "red",
  provider_payouts: "green",
  provider_membership: "red",
  provider_compliance: "yellow",
  provider_drivers: "green",
  provider_vehicles: "green",
  admin_reservations: "green",
  admin_dispatch: "yellow",
  admin_trips: "green",
  admin_providers: "yellow",
  admin_payouts: "yellow",
};

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
  table: string,
  timeCol: string,
  since: string,
  filter: (q: any) => any,
): Promise<number> {
  let q = supabase.from(table).select("id", { count: "exact", head: true }).gt(timeCol, since);
  q = filter(q);
  const { count } = await q;
  return count ?? 0;
}

/**
 * Return per-tab unread counts for the current user, scoped by role/RLS.
 * RLS on every source table is the security boundary — we only count rows
 * the user can already read.
 */
export const getUnreadCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const marks = await loadMarks(supabase, userId);

    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesData ?? []).map((r: any) => r.role as string);
    const isOps = roles.some((r) =>
      ["admin", "app_manager", "zone_manager", "dispatcher", "staff"].includes(r),
    );

    const counts: Partial<Record<TabKey, number>> = {};

    // ── Requester queues ────────────────────────────────────────────────
    counts.patient_sent = await countSince(
      supabase, "ride_requests", "created_at",
      marks[TAB_KEYS.patientSent] ?? EPOCH,
      (q) => q.eq("requester_user_id", userId),
    );
    counts.facility_sent = await countSince(
      supabase, "trips", "created_at",
      marks[TAB_KEYS.facilitySent] ?? EPOCH,
      (q) => q.eq("created_by", userId),
    );

    // ── Provider queues ─────────────────────────────────────────────────
    // Count new trips assigned to OR created by this provider since last view,
    // so provider-created trips light up their own Reservations badge too.
    counts.provider_reservations = await countSince(
      supabase, "trips", "created_at",
      marks[TAB_KEYS.providerReservations] ?? EPOCH,
      (q) => q.or(`assigned_to.eq.${userId},created_by.eq.${userId}`),
    );
    counts.provider_referrals = await countSince(
      supabase, "trips", "created_at",
      marks[TAB_KEYS.providerReferrals] ?? EPOCH,
      (q) => q.eq("priority_offer_provider_id", userId),
    );

    // Failed payments belonging to the provider — snapshot (not "since"), always red.
    try {
      const { count: failed } = await supabase
        .from("trip_payments")
        .select("id", { count: "exact", head: true })
        .eq("provider_user_id", userId)
        .eq("status", "failed");
      counts.provider_payments = failed ?? 0;
    } catch { counts.provider_payments = 0; }

    // New payouts posted to this provider since last view.
    counts.provider_payouts = await countSince(
      supabase, "fin_payouts", "created_at",
      marks[TAB_KEYS.providerPayouts] ?? EPOCH,
      (q) => q.eq("provider_user_id", userId),
    );

    // Membership: snapshot — non-zero when denied/caution requires action.
    try {
      const { data: prof } = await supabase
        .from("member_profiles")
        .select("membership_status")
        .eq("user_id", userId)
        .maybeSingle();
      const s = String(prof?.membership_status ?? "").toLowerCase();
      counts.provider_membership = s === "denied" || s === "past_due" || s === "canceled" ? 1 : 0;
    } catch { counts.provider_membership = 0; }

    // Compliance: count expired / missing critical credentials as snapshot.
    try {
      const nowIso = new Date().toISOString();
      const { count: expired } = await supabase
        .from("provider_credentials")
        .select("id", { count: "exact", head: true })
        .eq("provider_user_id", userId)
        .lt("expires_at", nowIso);
      counts.provider_compliance = expired ?? 0;
    } catch { counts.provider_compliance = 0; }

    // Fleet: new drivers / vehicles since last view.
    counts.provider_drivers = await countSince(
      supabase, "drivers", "created_at",
      marks[TAB_KEYS.providerDrivers] ?? EPOCH,
      (q) => q.eq("owner_id", userId),
    );
    counts.provider_vehicles = await countSince(
      supabase, "vehicles", "created_at",
      marks[TAB_KEYS.providerVehicles] ?? EPOCH,
      (q) => q.eq("owner_id", userId),
    );

    // ── Admin / ops queues ──────────────────────────────────────────────
    if (isOps) {
      counts.admin_reservations = await countSince(
        supabase, "ride_requests", "created_at",
        marks[TAB_KEYS.adminReservations] ?? EPOCH,
        (q) => q,
      );
      counts.admin_dispatch = await countSince(
        supabase, "trips", "created_at",
        marks[TAB_KEYS.adminDispatch] ?? EPOCH,
        (q) => q.in("status", ["open", "new", "pending"]),
      );
      counts.admin_trips = await countSince(
        supabase, "trips", "created_at",
        marks[TAB_KEYS.adminTrips] ?? EPOCH,
        (q) => q,
      );

      // Providers pending admin review (caution / review compliance status).
      try {
        const { count: pending } = await supabase
          .from("provider_applications")
          .select("id", { count: "exact", head: true })
          .in("compliance_status", ["caution", "review", "pending"]);
        counts.admin_providers = pending ?? 0;
      } catch { counts.admin_providers = 0; }

      // Payouts awaiting approval / release.
      try {
        const { count: pendingPay } = await supabase
          .from("fin_payouts")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
        counts.admin_payouts = pendingPay ?? 0;
      } catch { counts.admin_payouts = 0; }
    }

    return { ok: true as const, counts, severities: SEVERITY };
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

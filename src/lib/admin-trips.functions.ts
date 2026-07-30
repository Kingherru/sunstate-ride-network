import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireOps(context: any) {
  const roles = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"];
  for (const r of roles) {
    const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: r });
    if (data) return;
  }
  throw new Error("Forbidden");
}

export const listAllTripsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { status?: string; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await requireOps(context);
    let q = context.supabase
      .from("trips")
      .select("id, display_id, status, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, transport_type, cost_total, provider_payout_cents, platform_fee_cents, referral_fee_cents, referral_fee_source_user_id, payment_status, payout_status, source, created_by, assigned_to, created_at")
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) return [] as any[];

    // Attach original + assigned provider display names.
    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.created_by, r.assigned_to, r.referral_fee_source_user_id].filter(Boolean))
    )) as string[];
    let profiles: Record<string, { name: string; company: string | null }> = {};
    if (userIds.length > 0) {
      const { data: prof } = await context.supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, company_name")
        .in("user_id", userIds);
      for (const p of (prof ?? []) as any[]) {
        profiles[p.user_id] = {
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.company_name || p.user_id.slice(0, 8),
          company: p.company_name ?? null,
        };
      }
    }
    return rows.map((r: any) => ({
      ...r,
      original_provider_name: r.created_by ? (profiles[r.created_by]?.company ?? profiles[r.created_by]?.name ?? null) : null,
      assigned_provider_name: r.assigned_to ? (profiles[r.assigned_to]?.company ?? profiles[r.assigned_to]?.name ?? null) : null,
    }));
  });

/**
 * Direct Referrals: trips that entered the platform (public request form, API,
 * facility, etc.) and have no provider assigned yet. Ops/dispatch triage these
 * here; once a provider is assigned they flow into the normal reservation
 * workflow and drop off this list.
 */
export const listDirectReferralsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { source?: string; limit?: number } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await requireOps(context);
    let q = context.supabase
      .from("trips")
      .select(
        "id, display_id, status, source, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, patient_phone, transport_type, trip_kind, medicaid_trip, cost_total, dispatch_zone_id, referral_status, referral_target_id, created_by, created_at",
      )
      .is("assigned_to", null)
      .not("status", "in", "(completed,canceled,no_show)")
      .order("pickup_date", { ascending: true })
      .order("pickup_time", { ascending: true })
      .limit(Math.min(data.limit ?? 200, 500));
    if (data.source && data.source !== "all") q = q.eq("source", data.source);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) return [] as any[];

    const userIds = Array.from(
      new Set(rows.flatMap((r: any) => [r.created_by, r.referral_target_id].filter(Boolean))),
    ) as string[];
    const names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: prof } = await context.supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, company_name")
        .in("user_id", userIds);
      for (const p of (prof ?? []) as any[]) {
        names[p.user_id] =
          p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id.slice(0, 8);
      }
    }

    const zoneIds = Array.from(new Set(rows.map((r: any) => r.dispatch_zone_id).filter(Boolean))) as string[];
    const zones: Record<string, string> = {};
    if (zoneIds.length > 0) {
      const { data: z } = await context.supabase.from("dispatch_zones").select("id, name").in("id", zoneIds);
      for (const row of (z ?? []) as any[]) zones[row.id] = row.name;
    }

    return rows.map((r: any) => ({
      ...r,
      created_by_name: r.created_by ? (names[r.created_by] ?? null) : null,
      referral_target_name: r.referral_target_id ? (names[r.referral_target_id] ?? null) : null,
      zone_name: r.dispatch_zone_id ? (zones[r.dispatch_zone_id] ?? null) : null,
    }));
  });


export const listAllReservationsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      status?: string;
      reservation_state?: "unconfirmed" | "booked" | "past" | "history" | "all";
      limit?: number;
    } | undefined) => input ?? {},
  )
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const state = data.reservation_state ?? "unconfirmed";
    let q = context.supabase
      .from("ride_requests")
      .select("id, status, reservation_state, pickup_date, pickup_time, pickup_city, pickup_zip, dropoff_city, dropoff_zip, patient_first_name, patient_last_name, transport_type, requester_user_id, created_at, assigned_provider_id")
      .order("pickup_date", { ascending: state === "past" || state === "history" })
      .order("pickup_time", { ascending: false })
      .limit(Math.min(data.limit ?? 200, 500));
    if (state !== "all") q = q.eq("reservation_state", state);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });


export const getAdminReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const { data: row, error } = await context.supabase
      .from("ride_requests")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Reservation not found");
    return row;
  });

export const suggestProvidersForReservation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await requireOps(context);
    const { data: r, error: rErr } = await context.supabase
      .from("ride_requests")
      .select("pickup_zip, pickup_city, transport_type")
      .eq("id", data.id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) throw new Error("Reservation not found");

    // Only approved, active transportation providers — never admin/staff or facility accounts.
    const { data: providers, error: pErr } = await (context.supabase as any).rpc("list_eligible_providers");
    if (pErr) throw pErr;

    const zip = (r.pickup_zip ?? "").trim();
    const city = (r.pickup_city ?? "").trim().toLowerCase();
    const scored = (providers ?? []).map((p: any) => {
      const zips: string[] = Array.isArray(p.preferred_zip_codes) ? p.preferred_zip_codes : [];
      const zipMatch = zip && zips.includes(zip);
      const cityMatch = city && (p.city ?? "").toLowerCase() === city;
      const score = (zipMatch ? 2 : 0) + (cityMatch ? 1 : 0);
      return { ...p, score, reason: zipMatch ? "ZIP match" : cityMatch ? "City match" : "Active provider" };
    })
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 25);

    return scored;
  });

export const pushReservationToProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reservation_id: z.string().uuid(), provider_user_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireOps(context);

    // Reject anything that is not an approved, active transportation provider
    const { data: eligible, error: eErr } = await (context.supabase as any).rpc(
      "is_eligible_transport_provider",
      { _user_id: data.provider_user_id },
    );
    if (eErr) throw eErr;
    if (!eligible) throw new Error("That account is not an approved transportation provider");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: r, error: rErr } = await (supabaseAdmin as any)
      .from("ride_requests")
      .select("id, pickup_date, pickup_time, pickup_city, patient_first_name, patient_last_name")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!r) throw new Error("Reservation not found");

    const { error: updErr } = await (supabaseAdmin as any)
      .from("ride_requests")
      .update({
        assigned_provider_id: data.provider_user_id,
        status: "assigned",
        last_updated_at: new Date().toISOString(),
      })
      .eq("id", data.reservation_id);
    if (updErr) throw updErr;

    const title = "New trip offered to you";
    const body = `${r.patient_first_name ?? ""} ${r.patient_last_name ?? ""} — ${r.pickup_city ?? ""} on ${r.pickup_date} ${String(r.pickup_time ?? "").slice(0,5)}`.trim();
    await (supabaseAdmin as any).from("notifications").insert({
      user_id: data.provider_user_id,
      type: "trip_offer",
      title,
      body,
      link: `/requests/${data.reservation_id}`,
      ride_request_id: data.reservation_id,
    });

    return { ok: true };
  });

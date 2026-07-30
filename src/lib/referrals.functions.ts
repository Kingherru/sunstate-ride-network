import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Canonical MyFloridaNEMT dispatch account. Referred trips sent to this user land in the MFN admin/dispatch queues. */
const MFN_USER_ID = "fd011b5d-5645-47e4-b71c-404b13c14880";

async function loadTripForReferral(
  supabase: any,
  tripId: string,
) {
  const { data, error } = await supabase
    .from("trips")
    .select(
      "id, created_by, assigned_to, referral_target_id, referral_status, reservation_state, status",
    )
    .eq("id", tripId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Reservation not found.");
  return data;
}

/**
 * Providers connected to the caller: distinct users the caller has previously
 * completed a trip with (as sender or recipient). Used to populate the
 * "Send to Provider" picker on unconfirmed reservations.
 */
export const listConnectedProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("trips")
      .select("created_by, assigned_to")
      .eq("status", "completed")
      .or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
    if (error) throw error;

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      const other = r.created_by === userId ? r.assigned_to : r.created_by;
      if (other && other !== userId && other !== MFN_USER_ID) ids.add(other);
    }
    if (ids.size === 0) return [] as Array<{ user_id: string; name: string; company: string | null }>;

    // Only accounts eligible to actually perform trips (no admin/staff/facility).
    const { data: eligible, error: eErr } = await supabase.rpc("list_eligible_providers_in_region", {
      _region: null as unknown as string,
    });
    if (eErr) throw eErr;
    const eligibleIds = new Set((eligible ?? []).map((p: any) => p.user_id as string));
    const filtered = Array.from(ids).filter((id) => eligibleIds.has(id));
    if (filtered.length === 0) return [] as Array<{ user_id: string; name: string; company: string | null }>;

    const { data: profiles, error: pErr } = await supabase
      .from("member_profiles")
      .select("user_id, first_name, last_name, company_name")
      .in("user_id", filtered);
    if (pErr) throw pErr;

    return (profiles ?? []).map((p: any) => ({
      user_id: p.user_id as string,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Provider",
      company: p.company_name ?? null,
    }));
  });


/**
 * Send an unconfirmed reservation into the referral workflow. Target can be
 * "mfn" (My Florida NEMT) or a specific connected provider user id. No duplicate
 * reservation is created — the same trip row is routed to the recipient, who
 * accepts or declines through the normal review dialog.
 */
export const referTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        target: z.union([z.literal("mfn"), z.string().uuid()]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await loadTripForReferral(supabase, data.trip_id);
    if (trip.created_by !== userId) {
      throw new Error("Only the reservation creator can route this trip.");
    }
    if ((trip.reservation_state ?? "unconfirmed") !== "unconfirmed") {
      throw new Error("This reservation is no longer routable.");
    }
    if (trip.referral_status === "pending") {
      throw new Error("This reservation is already awaiting a referral response.");
    }
    if (trip.assigned_to && trip.assigned_to !== userId) {
      throw new Error("This reservation is already assigned to a provider.");
    }

    const targetId = data.target === "mfn" ? MFN_USER_ID : data.target;
    if (targetId === userId) throw new Error("You cannot route a trip to yourself.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const { error: uErr } = await supabaseAdmin
      .from("trips")
      .update({
        referral_target_id: targetId,
        referral_status: "pending",
        referral_sent_at: now,
        referral_decided_at: null,
        referral_decline_reason: null,
      })
      .eq("id", data.trip_id);
    if (uErr) throw uErr;

    await supabaseAdmin.from("trip_referral_history").insert({
      trip_id: data.trip_id,
      from_user_id: userId,
      to_user_id: targetId,
      action: "sent",
      reason: data.target === "mfn" ? "Sent to My Florida NEMT" : null,
    });

    // Notify the recipient (best-effort — do not block on failure).
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: targetId,
        type: "referral_received",
        title: "New reservation referral",
        body: "A reservation has been referred to you for review.",
        link: `/dashboard?trip=${data.trip_id}`,
      });
    } catch { /* non-fatal */ }

    return { ok: true as const };
  });

/**
 * Recipient accepts or declines a pending referral. Accept promotes the trip
 * to the recipient (assigned_to + status='accepted'); decline returns
 * ownership to the sender so they can route it again.
 */
export const respondToReferral = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        trip_id: z.string().uuid(),
        accept: z.boolean(),
        reason: z.string().trim().max(500).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const trip = await loadTripForReferral(supabase, data.trip_id);
    if (trip.referral_status !== "pending" || trip.referral_target_id !== userId) {
      throw new Error("This referral is not awaiting your response.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    if (data.accept) {
      const { error } = await supabaseAdmin
        .from("trips")
        .update({
          assigned_to: userId,
          status: "accepted",
          referral_status: "accepted",
          referral_decided_at: now,
        })
        .eq("id", data.trip_id);
      if (error) throw error;

      await supabaseAdmin.from("trip_referral_history").insert({
        trip_id: data.trip_id,
        from_user_id: trip.created_by,
        to_user_id: userId,
        action: "accepted",
        reason: data.reason ?? null,
      });
      return { ok: true as const, accepted: true };
    }

    // Decline: return ownership to sender so they can re-route.
    const { error } = await supabaseAdmin
      .from("trips")
      .update({
        referral_target_id: null,
        referral_status: "declined",
        referral_decided_at: now,
        referral_decline_reason: (data.reason ?? "").trim() || null,
      })
      .eq("id", data.trip_id);
    if (error) throw error;

    await supabaseAdmin.from("trip_referral_history").insert({
      trip_id: data.trip_id,
      from_user_id: trip.created_by,
      to_user_id: userId,
      action: "declined",
      reason: (data.reason ?? "").trim() || null,
    });

    // Auto re-route to the next eligible provider in the service area, if any.
    // When nobody is left the trip stays unassigned for manual dispatch.
    let rerouted_to: string | null = null;
    try {
      const { data: next } = await supabaseAdmin.rpc("refer_next_eligible_provider", {
        _trip_id: data.trip_id,
      });
      rerouted_to = (next as string | null) ?? null;
    } catch { /* non-fatal — dispatch can route manually */ }

    return { ok: true as const, accepted: false, rerouted: !!rerouted_to };
  });


/** Full referral history for a trip. Visible to sender, recipient, referral target, and staff. */
export const listTripReferralHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trip_referral_history")
      .select("id, trip_id, from_user_id, to_user_id, action, reason, created_at")
      .eq("trip_id", data.trip_id)
      .order("created_at", { ascending: false });
    if (error) throw error;

    const ids = new Set<string>();
    for (const r of rows ?? []) {
      if (r.from_user_id) ids.add(r.from_user_id);
      if (r.to_user_id) ids.add(r.to_user_id);
    }
    let nameMap: Record<string, string> = {};
    if (ids.size > 0) {
      const { data: profiles } = await context.supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, company_name")
        .in("user_id", Array.from(ids));
      for (const p of profiles ?? []) {
        const nm = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
        nameMap[p.user_id] = p.company_name || nm || "User";
      }
    }
    nameMap["fd011b5d-5645-47e4-b71c-404b13c14880"] = "My Florida NEMT";

    return (rows ?? []).map((r: any) => ({
      ...r,
      from_name: nameMap[r.from_user_id] ?? "User",
      to_name: nameMap[r.to_user_id] ?? "User",
    }));
  });

/**
 * Referral Reservations — referrals the caller already ACCEPTED in the
 * Referrals tab (referral_status = 'accepted', assigned to the caller) that
 * still need the provider's final confirmation. Once confirmed they move onto
 * the Schedule Board. No invoice is sent from this flow.
 */
export const listReferralReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("trips")
      .select(
        "id, display_id, status, reservation_state, pickup_address, pickup_city, dropoff_address, dropoff_city, pickup_date, pickup_time, appointment_time, round_trip, return_date, service_level, transport_type, needs_wheelchair, patient_first_name, patient_last_name, patient_phone, is_medicaid, payer, estimated_cost_cents, referral_status, referral_decided_at, driver_id, scheduled_start_time",
      )
      .eq("assigned_to", userId)
      .eq("referral_status", "accepted")
      .in("status", ["accepted", "assigned"])
      .order("pickup_date", { ascending: true })
      .order("pickup_time", { ascending: true })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  });

/**
 * Provider confirms an accepted referral. Marks the trip confirmed so it lands
 * on the Schedule Board. Deliberately does NOT send an invoice.
 */
export const confirmReferralReservation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ trip_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip, error } = await supabase
      .from("trips")
      .select("id, assigned_to, referral_status, status")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (error) throw error;
    if (!trip) throw new Error("Reservation not found.");
    if (trip.assigned_to !== userId) throw new Error("This referral is not assigned to you.");
    if (trip.referral_status !== "accepted") throw new Error("This trip is not an accepted referral.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: uErr } = await supabaseAdmin
      .from("trips")
      .update({ status: "confirmed" })
      .eq("id", data.trip_id);
    if (uErr) throw uErr;
    return { ok: true as const };
  });

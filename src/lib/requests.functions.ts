import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT_COLS =
  "id, status, created_at, last_updated_at, canceled_at, cancel_reason, pickup_address, pickup_city, pickup_date, pickup_time, dropoff_address, dropoff_city, transport_type, trip_type, round_trip, additional_stops, recurrence_rule, recurrence_exceptions, recurrence_end_date, patient_first_name, patient_last_name, patient_phone, patient_email, mobility_notes, special_instructions, provider_notes, payment_status, payment_amount_cents, assigned_provider_id, requester_user_id, distance_miles, estimated_cost_cents, estimated_duration_seconds, estimated_duration_traffic_seconds, route_polyline, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng";

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ride_requests")
      .select(SELECT_COLS)
      .eq("requester_user_id", userId)
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false });
    if (error) {
      console.error("listMyRequests error", error);
      return { ok: false as const, error: "Could not load your ride requests." };
    }
    return { ok: true as const, rows: data ?? [] };
  });

export const getMyRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ride_requests")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("getMyRequest error", error);
      return { ok: false as const, error: "Could not load that request." };
    }
    if (!row) return { ok: false as const, error: "Request not found." };
    return { ok: true as const, row };
  });

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  /** For recurring: 'next' skips the next occurrence; 'all_future' ends the series today; 'single' cancels a one-off request. */
  scope: z.enum(["single", "next", "all_future"]).default("single"),
});

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch row first so we can validate scope + compute updates
    const { data: row, error: readErr } = await supabase
      .from("ride_requests")
      .select(
        "id, status, recurrence_rule, recurrence_exceptions, recurrence_end_date, pickup_date, requester_user_id"
      )
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (readErr || !row) {
      return { ok: false as const, error: "Request not found." };
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    if (data.scope === "next" && row.recurrence_rule) {
      const exceptions = Array.isArray(row.recurrence_exceptions) ? row.recurrence_exceptions : [];
      if (!exceptions.includes(row.pickup_date)) exceptions.push(row.pickup_date);
      const { error } = await supabase
        .from("ride_requests")
        .update({ recurrence_exceptions: exceptions })
        .eq("id", data.id)
        .eq("requester_user_id", userId);
      if (error) return { ok: false as const, error: "Could not skip the next occurrence." };
      return { ok: true as const, scope: "next" as const };
    }

    if (data.scope === "all_future" && row.recurrence_rule) {
      const { error } = await supabase
        .from("ride_requests")
        .update({
          recurrence_end_date: todayIso,
          status: "canceled",
          canceled_at: new Date().toISOString(),
          cancel_reason: data.reason || null,
        })
        .eq("id", data.id)
        .eq("requester_user_id", userId);
      if (error) return { ok: false as const, error: "Could not end the recurring series." };
      return { ok: true as const, scope: "all_future" as const };
    }

    // single (default) — full cancel
    const { error } = await supabase
      .from("ride_requests")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: data.reason || null,
      })
      .eq("id", data.id)
      .eq("requester_user_id", userId);
    if (error) return { ok: false as const, error: "Could not cancel that request." };
    return { ok: true as const, scope: "single" as const };
  });

const additionalStopSchema = z.object({
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(1).max(100),
  note: z.string().trim().max(300).optional().or(z.literal("")),
});

const rescheduleSchema = z.object({
  id: z.string().uuid(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupCity: z.string().trim().min(1).max(100),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  // Passenger details (editable from detail page)
  patientFirstName: z.string().trim().min(1).max(80).optional(),
  patientLastName: z.string().trim().min(1).max(80).optional(),
  patientPhone: z.string().trim().min(7).max(30).optional(),
  patientEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  mobilityNotes: z.string().trim().max(1000).optional().or(z.literal("")),
  // Trip shape
  tripType: z.enum(["one_way", "round_trip", "multi_trip"]).optional(),
  additionalStops: z.array(additionalStopSchema).max(10).optional(),
});

export const rescheduleMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rescheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Block reschedule once dispatched/assigned/completed
    const { data: row } = await supabase
      .from("ride_requests")
      .select("status, assigned_provider_id")
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "Request not found." };
    const s = (row.status ?? "").toLowerCase();
    if ((row as any).assigned_provider_id) {
      return { ok: false as const, error: "This trip has been assigned to a provider and can no longer be edited by the requester. Please contact dispatch." };
    }

    if (["completed", "canceled", "cancelled", "in_progress", "assigned"].includes(s)) {
      return { ok: false as const, error: `This trip has been claimed or dispatched and can no longer be edited by the requester. Please contact dispatch to make changes.` };
    }


    const update: Record<string, unknown> = {
      pickup_date: data.pickupDate,
      pickup_time: data.pickupTime,
      pickup_address: data.pickupAddress,
      pickup_city: data.pickupCity,
      special_instructions: data.specialInstructions || null,
    };
    if (data.patientFirstName !== undefined) update.patient_first_name = data.patientFirstName;
    if (data.patientLastName !== undefined) update.patient_last_name = data.patientLastName;
    if (data.patientPhone !== undefined) update.patient_phone = data.patientPhone;
    if (data.patientEmail !== undefined) update.patient_email = data.patientEmail || null;
    if (data.mobilityNotes !== undefined) update.mobility_notes = data.mobilityNotes || null;
    if (data.tripType !== undefined) {
      update.trip_type = data.tripType;
      update.round_trip = data.tripType === "round_trip";
      if (data.tripType !== "multi_trip") update.additional_stops = [];
    }
    if (data.additionalStops !== undefined) update.additional_stops = data.additionalStops;

    const { error } = await supabase
      .from("ride_requests")
      .update(update as never)
      .eq("id", data.id)
      .eq("requester_user_id", userId);
    if (error) {
      console.error("rescheduleMyRequest error", error);
      return { ok: false as const, error: "Could not update that request." };
    }
    return { ok: true as const };
  });

// ---------- Notifications ----------

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, ride_request_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: "Could not load notifications." };
    return { ok: true as const, rows: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    const { error } = data.all ? await q : await q.eq("id", data.id ?? "");
    if (error) return { ok: false as const, error: "Could not mark notifications read." };
    return { ok: true as const };
  });

/**
 * Return full reservation detail for the assigned provider (or admin/staff).
 * Used by the Reservation Review page. Returns both the "original request"
 * fields and the "reservation" fields from the same ride_requests row —
 * historical audit of edits will be added when a revisions table exists.
 */
export const getReservationReview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const cols =
      SELECT_COLS +
      ", pickup_address_details, pickup_zip, dropoff_zip, appointment_time, return_pickup_time, return_dropoff_time, dispatch_source, scheduled_start_time, assigned_driver_id, service_level, needs_wheelchair, payer, medicaid_number, medicaid_plan";
    const { data: row, error } = await supabase
      .from("ride_requests")
      .select(cols)
      .eq("id", data.id)
      .maybeSingle();
    if (error) return { ok: false as const, error: "Could not load reservation." };
    if (!row) return { ok: false as const, error: "Reservation not found." };

    // Authorize: assigned provider, requester, or ops staff.
    const isProvider = (row as any).assigned_provider_id === userId;
    const isRequester = (row as any).requester_user_id === userId;
    let isStaff = false;
    if (!isProvider && !isRequester) {
      const { data: r } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .in("role", ["admin", "staff", "app_manager", "dispatcher"] as any)
        .maybeSingle();
      if (r) isStaff = true;
    }
    if (!isProvider && !isRequester && !isStaff) {
      return { ok: false as const, error: "You do not have access to this reservation." };
    }

    // Look up driver if assigned.
    let driver: { first_name: string | null; last_name: string | null; phone: string | null } | null = null;
    const driverId = (row as any).assigned_driver_id as string | null;
    if (driverId) {
      const { data: d } = await supabase
        .from("drivers")
        .select("first_name, last_name, phone")
        .eq("id", driverId)
        .maybeSingle();
      driver = d ?? null;
    }
    return { ok: true as const, row, driver };
  });

/** List change history for a ride request (visible to requester, assigned provider, or staff). */
export const listRequestHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("ride_request_history")
      .select("id, created_at, changed_by, changed_by_role, changed_by_email, action, changes, summary")
      .eq("ride_request_id", data.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("listRequestHistory error", error);
      return { ok: false as const, error: "Could not load history." };
    }
    return { ok: true as const, rows: rows ?? [] };
  });

// ---------- Copy trip to multiple dates ----------

const copyDateEntrySchema = z.object({
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  appointmentTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  returnPickupTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
  returnDropoffTime: z.string().regex(/^\d{2}:\d{2}$/).optional().or(z.literal("")),
});

const copyToDatesSchema = z.object({
  sourceId: z.string().uuid(),
  dates: z.array(copyDateEntrySchema).min(1).max(60),
});

// Fields to copy from the source trip. Everything trip-shape-related is duplicated;
// per-occurrence status, assignment, payment, timing, and audit fields are reset.
const COPY_FIELDS = [
  "patient_first_name",
  "patient_last_name",
  "patient_phone",
  "patient_email",
  "pickup_address",
  "pickup_address_details",
  "pickup_city",
  "pickup_zip",
  "dropoff_address",
  "dropoff_city",
  "dropoff_zip",
  "transport_type",
  "trip_type",
  "round_trip",
  "additional_stops",
  "mobility_notes",
  "special_instructions",
  "is_black_tie",
  "black_tie_vehicle",
  "trip_billing_source",
  "trip_billing_first_name",
  "trip_billing_last_name",
  "trip_billing_email",
  "trip_billing_phone",
  "payer",
  "medicaid_number",
  "medicaid_plan",
  "service_level",
  "needs_wheelchair",
  "embed_provider_id",
  "embed_token",
] as const;

export const copyRequestToDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => copyToDatesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const cols = COPY_FIELDS.join(", ");
    const { data: source, error: readErr } = await supabase
      .from("ride_requests")
      .select(cols)
      .eq("id", data.sourceId)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (readErr || !source) {
      return { ok: false as const, error: "Original trip not found." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rows = data.dates.map((d) => {
      const base: Record<string, unknown> = {};
      for (const f of COPY_FIELDS) base[f] = (source as any)[f] ?? null;
      base.requester_user_id = userId;
      base.pickup_date = d.pickupDate;
      base.pickup_time = d.pickupTime;
      base.appointment_time = d.appointmentTime || null;
      base.return_pickup_time = d.returnPickupTime || null;
      base.return_dropoff_time = d.returnDropoffTime || null;
      base.status = "pending";
      // Each copy is an independent one-off trip (never a recurring series).
      base.recurrence_rule = null;
      base.recurrence_end_date = null;
      base.recurrence_exceptions = [];
      base.black_tie_quote_status = (source as any).is_black_tie ? "awaiting_quote" : "awaiting_quote";
      return base;
    });

    const { data: inserted, error: insErr } = await (supabaseAdmin as any)
      .from("ride_requests")
      .insert(rows)
      .select("id, pickup_date, pickup_time");
    if (insErr) {
      console.error("copyRequestToDates error", insErr);
      return { ok: false as const, error: "Could not copy the trip. Please try again." };
    }
    return { ok: true as const, rows: inserted ?? [] };
  });




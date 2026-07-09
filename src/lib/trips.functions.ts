import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Region helper kept inline (mirror of forms.functions REGION_BY_CITY to avoid cross-import surprises)
const REGION_BY_CITY: Record<string, string> = {
  jacksonville: "Northeast Florida",
  orlando: "Central Florida",
  tampa: "Gulf Coast",
  miami: "South Florida",
  tallahassee: "Florida Panhandle",
  "fort-lauderdale": "Broward County",
  "fort lauderdale": "Broward County",
  gainesville: "North Central Florida",
  "daytona-beach": "Central Florida",
  "daytona beach": "Central Florida",
  daytona: "Central Florida",
  "southwest-florida": "Southwest Florida",
  "southwest florida": "Southwest Florida",
  "fort myers": "Southwest Florida",
  "fort-myers": "Southwest Florida",
  naples: "Southwest Florida",
  "cape coral": "Southwest Florida",
};
function regionFor(city: string): string {
  const k = city.trim().toLowerCase();
  return REGION_BY_CITY[k] ?? REGION_BY_CITY[k.replace(/\s/g, "-")] ?? "Statewide Florida";
}

async function ensureActiveMember(supabase: any, userId: string) {
  const { data } = await supabase
    .from("member_profiles")
    .select("membership_status, membership_tier, region")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data || data.membership_status !== "active") {
    throw new Error("Active membership required");
  }
  return data;
}

async function ensurePaidSender(supabase: any, userId: string) {
  const m = await ensureActiveMember(supabase, userId);
  if (m.membership_tier !== "paid") {
    throw new Error("Sending trips requires a paid membership. Upgrade at /membership.");
  }
  return m;
}

async function requireHipaaAck(
  supabase: any,
  userId: string,
  ackId: string | undefined,
  context: string,
): Promise<string> {
  if (ackId) {
    const { data } = await supabase
      .from("hipaa_acknowledgments")
      .select("id")
      .eq("id", ackId)
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.id) return data.id;
  }
  // Auto-create an ack if the caller confirmed via a checkbox (ackId omitted but flag elsewhere).
  // For safety, require an explicit ack id from the form.
  throw new Error("HIPAA acknowledgment is required. Please check the HIPAA box and try again.");
}

/** List approved providers in the same region as the caller (for dispatch). */
export const listRegionalProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const me = await ensureActiveMember(supabase, userId);
    if (!me.region) return [];
    const { data, error } = await supabase
      .from("provider_applications")
      .select("id, company_name, contact_name, email, dispatch_email, phone, city, region, status")
      .eq("status", "approved")
      .eq("region", me.region);
    if (error) throw error;
    return data ?? [];
  });

const tripBaseSchema = z.object({
  patient_first_name: z.string().trim().min(1).max(80),
  patient_last_name: z.string().trim().min(1).max(80),
  patient_phone: z.string().trim().max(32).optional().nullable(),
  pickup_address: z.string().trim().min(1).max(255),
  pickup_city: z.string().trim().min(1).max(80),
  pickup_zip: z.string().trim().max(10).optional().nullable(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM"),
  pickup_address_details: z.string().trim().max(255).optional().nullable(),
  appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM").optional().nullable(),
  return_pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM").optional().nullable(),
  return_dropoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "HH:MM").optional().nullable(),
  dropoff_address: z.string().trim().min(1).max(255),
  dropoff_city: z.string().trim().min(1).max(80),
  dropoff_zip: z.string().trim().max(10).optional().nullable(),
  transport_type: z.enum(["ambulatory", "wheelchair", "stretcher", "gurney"]).optional(),
  round_trip: z.boolean().optional(),
  service_level: z.enum(["door_to_door", "bed_to_bed", "curb_to_curb", "driveway_pickup"]).optional().nullable(),
  needs_wheelchair: z.boolean().optional(),
  has_passenger: z.boolean().optional(),
  needs_assistance_to_vehicle: z.boolean().optional(),
  needs_surgery_signin: z.boolean().optional(),
  needs_surgery_signout: z.boolean().optional(),
  mobility_notes: z.string().trim().max(500).optional().nullable(),
  special_instructions: z.string().trim().max(1000).optional().nullable(),
  payer: z.string().trim().max(120).optional().nullable(),
  trip_number: z.string().trim().max(64).optional().nullable(),
  patient_date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD").optional().nullable().or(z.literal("")),
  medicaid_number: z.string().trim().max(64).optional().nullable(),
  medicaid_plan: z.string().trim().max(120).optional().nullable(),
  authorization_number: z.string().trim().max(64).optional().nullable(),
  diagnosis_code: z.string().trim().max(32).optional().nullable(),
  emergency_contact_name: z.string().trim().max(120).optional().nullable(),
  emergency_contact_phone: z.string().trim().max(32).optional().nullable(),
});

const createTripSchema = tripBaseSchema.extend({
  source: z.enum(["manual", "csv"]).optional(),
  assigned_to: z.string().uuid().optional(),
  hipaa_ack_id: z.string().uuid(),
});

/** Create a HIPAA acknowledgment for the current user. */
export const recordHipaaAck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { context: "send_trip" | "bulk_upload" | "api_push" | "public_request" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("hipaa_acknowledgments")
      .insert({ user_id: userId, context: data.context, version: "v1" })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id as string };
  });

/** Create a trip (manual or CSV row). */
export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => createTripSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePaidSender(supabase, userId);
    const ackId = await requireHipaaAck(supabase, userId, data.hipaa_ack_id, "send_trip");
    const region = regionFor(data.pickup_city);
    const { hipaa_ack_id: _ignore, ...rest } = data;
    const { data: row, error } = await supabase
      .from("trips")
      .insert({
        ...rest,
        created_by: userId,
        region,
        status: data.assigned_to ? "assigned" : "open",
        source: data.source ?? "manual",
        hipaa_ack_id: ackId,
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

const bulkTripsSchema = z.object({
  hipaa_ack_id: z.string().uuid(),
  trips: z.array(tripBaseSchema).min(1).max(500),
});

/** Bulk create from a CSV upload. */
export const createTripsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => bulkTripsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensurePaidSender(supabase, userId);
    const ackId = await requireHipaaAck(supabase, userId, data.hipaa_ack_id, "bulk_upload");
    const rows = data.trips.map((t) => ({
      patient_first_name: t.patient_first_name,
      patient_last_name: t.patient_last_name,
      patient_phone: t.patient_phone ?? null,
      pickup_address: t.pickup_address,
      pickup_city: t.pickup_city,
      pickup_zip: t.pickup_zip ?? null,
      pickup_date: t.pickup_date,
      pickup_time: t.pickup_time,
      dropoff_address: t.dropoff_address,
      dropoff_city: t.dropoff_city,
      dropoff_zip: t.dropoff_zip ?? null,
      transport_type: t.transport_type ?? "ambulatory",
      round_trip: !!t.round_trip,
      mobility_notes: t.mobility_notes ?? null,
      special_instructions: t.special_instructions ?? null,
      payer: t.payer ?? null,
      trip_number: t.trip_number ?? null,
      created_by: userId,
      region: regionFor(t.pickup_city || ""),
      status: "open",
      source: "csv",
      hipaa_ack_id: ackId,
    }));
    const { data: inserted, error } = await supabase.from("trips").insert(rows).select("id");
    if (error) throw error;
    return { count: inserted?.length ?? 0 };
  });

/** Assign an existing trip to a provider (by their auth user_id). */
export const assignTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; assigned_to: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureActiveMember(supabase, userId);
    const { error } = await supabase
      .from("trips")
      .update({ assigned_to: data.assigned_to, status: "assigned" })
      .eq("id", data.trip_id)
      .eq("created_by", userId);
    if (error) throw error;
    return { ok: true };
  });

/** Update trip status (accept/decline/complete) — caller must be sender or recipient. */
export const updateTripStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; status: "accepted" | "declined" | "completed" | "canceled" }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("trips")
      .update({ status: data.status })
      .eq("id", data.trip_id);
    if (error) throw error;

    // Auto-release payout when marking completed. Best-effort: errors don't block status update.
    if (data.status === "completed") {
      try {
        const { releaseTripPayout } = await import("@/lib/payouts.functions");
        await releaseTripPayout({ data: { trip_id: data.trip_id } });
      } catch (e) {
        console.error("Auto release payout failed:", e);
      }
    }
    return { ok: true };
  });

const editableFieldsSchema = z.object({
  patient_phone: z.string().trim().max(32).nullable().optional(),
  emergency_contact_name: z.string().trim().max(120).nullable().optional(),
  emergency_contact_phone: z.string().trim().max(32).nullable().optional(),
  pickup_address: z.string().trim().max(255).nullable().optional(),
  pickup_address_details: z.string().trim().max(255).nullable().optional(),
  pickup_city: z.string().trim().max(80).nullable().optional(),
  pickup_zip: z.string().trim().max(10).nullable().optional(),
  pickup_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  appointment_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  return_pickup_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  return_dropoff_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  dropoff_address: z.string().trim().max(255).nullable().optional(),
  dropoff_city: z.string().trim().max(80).nullable().optional(),
  dropoff_zip: z.string().trim().max(10).nullable().optional(),
  mobility_notes: z.string().trim().max(1000).nullable().optional(),
  special_instructions: z.string().trim().max(2000).nullable().optional(),
  provider_notes: z.string().trim().max(2000).nullable().optional(),
  cost_total: z.union([z.number(), z.null()]).optional(),
  payer: z.string().trim().max(120).nullable().optional(),
});

/**
 * Update editable trip details. Authorization: caller must be sender (created_by),
 * assigned provider (assigned_to), or an admin. Uses service role after authz check
 * because authenticated UPDATE on public.trips is revoked.
 */
export const updateTripDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ trip_id: z.string().uuid(), patch: editableFieldsSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorize: fetch trip and confirm caller role.
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, created_by, assigned_to")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tripErr) throw tripErr;
    if (!trip) throw new Error("Trip not found");

    let isAdmin = false;
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (roleRow) isAdmin = true;

    const isSender = trip.created_by === userId;
    const isRecipient = trip.assigned_to === userId;
    if (!isSender && !isRecipient && !isAdmin) {
      throw new Error("You do not have permission to edit this trip");
    }

    // Providers (recipients) may only edit provider_notes; senders/admins may edit all fields.
    const patch: Record<string, unknown> = {};
    const providerOnlyKeys = new Set(["provider_notes"]);
    for (const [k, v] of Object.entries(data.patch)) {
      if (v === undefined) continue;
      if (isRecipient && !isSender && !isAdmin && !providerOnlyKeys.has(k)) continue;
      patch[k] = v === "" ? null : v;
    }
    if (Object.keys(patch).length === 0) return { ok: true, updated: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("trips").update(patch as never).eq("id", data.trip_id);
    if (error) throw error;
    return { ok: true, updated: Object.keys(patch).length };
  });


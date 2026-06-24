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

/** Create a trip (manual or CSV row). */
export const createTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    patient_first_name: string;
    patient_last_name: string;
    patient_phone?: string;
    pickup_address: string;
    pickup_city: string;
    pickup_zip?: string;
    pickup_date: string;
    pickup_time: string;
    dropoff_address: string;
    dropoff_city: string;
    dropoff_zip?: string;
    transport_type?: string;
    round_trip?: boolean;
    mobility_notes?: string;
    special_instructions?: string;
    payer?: string;
    trip_number?: string;
    source?: "manual" | "csv";
    assigned_to?: string;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureActiveMember(supabase, userId);
    const region = regionFor(data.pickup_city);
    const { data: row, error } = await supabase
      .from("trips")
      .insert({
        ...data,
        created_by: userId,
        region,
        status: data.assigned_to ? "assigned" : "open",
        source: data.source ?? "manual",
      })
      .select()
      .single();
    if (error) throw error;
    return row;
  });

/** Bulk create from a CSV upload. */
export const createTripsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trips: any[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureActiveMember(supabase, userId);
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
    return { ok: true };
  });

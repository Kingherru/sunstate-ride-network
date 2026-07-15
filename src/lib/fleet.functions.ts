import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/* ---- Drivers ---- */
export const listDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drivers").select("*").order("last_name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    first_name: string;
    last_name: string;
    phone?: string;
    email?: string;
    license_number?: string;
    license_expiry?: string | null;
    status?: "active" | "inactive" | "on_leave";
    notes?: string;
    employment_type?:
      | "independent_contractor"
      | "employee_w2"
      | "part_time"
      | "full_time"
      | "temporary"
      | "seasonal"
      | null;
    pay_type?: "hourly" | "daily_salary" | "per_trip" | "per_pickup_leg" | "per_mile" | "hybrid" | null;
    availability?: {
      mode: "weekly" | "flexible";
      days: Record<string, { off?: boolean; start?: string; end?: string }>;
    } | null;
    service_capabilities?: Array<"ambulatory" | "wheelchair" | "stretcher">;
    contractor_pricing?: {
      hourly_rate_cents?: number | null;
      daily_rate_cents?: number | null;
      per_pickup_leg_cents?: number | null;
      per_trip_cents?: number | null;
      per_mile_cents?: number | null;
      wait_time_per_hour_cents?: number | null;
      cancellation_fee_cents?: number | null;
      notes?: string | null;
    } | null;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, status: data.status ?? "active" };
    if (data.employment_type === undefined) delete row.employment_type;
    if (data.pay_type === undefined) delete row.pay_type;
    if (data.availability === undefined) delete row.availability;
    if (data.service_capabilities === undefined) delete row.service_capabilities;
    if (data.contractor_pricing === undefined) delete row.contractor_pricing;
    // Only independent contractors carry pricing — clear if employment type changed away.
    if (data.employment_type && data.employment_type !== "independent_contractor") {
      row.contractor_pricing = {};
    }
    const q = data.id
      ? supabase.from("drivers").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : supabase.from("drivers").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });


export const deleteDriver = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("drivers").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Vehicles ---- */
export const listVehicles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("vehicles").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

export const upsertVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    id?: string;
    name: string;
    plate?: string;
    vehicle_type?: "sedan" | "suv" | "van" | "wheelchair_van" | "stretcher_van" | "ambulance";
    capacity?: number;
    status?: "active" | "inactive" | "maintenance";
    notes?: string;
    assigned_driver_id?: string | null;
    service_capabilities?: Array<"ambulatory" | "wheelchair" | "stretcher">;
  }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const row: any = { ...data, owner_id: userId, vehicle_type: data.vehicle_type ?? "sedan", status: data.status ?? "active" };
    if (data.service_capabilities === undefined) delete row.service_capabilities;
    if (data.assigned_driver_id === undefined) delete row.assigned_driver_id;
    const q = data.id
      ? supabase.from("vehicles").update(row).eq("id", data.id).eq("owner_id", userId).select().single()
      : supabase.from("vehicles").insert(row).select().single();
    const { data: out, error } = await q;
    if (error) throw error;
    return out;
  });


export const deleteVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("vehicles").delete().eq("id", data.id).eq("owner_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/* ---- Trip assignment ---- */
export const assignDriverVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; driver_id?: string | null; vehicle_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: prior } = await supabase
      .from("trips").select("driver_id").eq("id", data.trip_id).single();
    const { error } = await supabase
      .from("trips")
      .update({ driver_id: data.driver_id ?? null, vehicle_id: data.vehicle_id ?? null })
      .eq("id", data.trip_id);
    if (error) throw error;

    if (data.driver_id && data.driver_id !== prior?.driver_id) {
      const { data: trip } = await supabase
        .from("trips").select("*").eq("id", data.trip_id).single();
      const { data: driver } = await supabase
        .from("drivers").select("first_name,email").eq("id", data.driver_id).single();
      if (trip && driver?.email) {
        const subject = `New trip assignment — ${trip.pickup_date} ${String(trip.pickup_time).slice(0, 5)}`;
        const body = [
          `Hi ${driver.first_name},`,
          ``,
          `You've been assigned a new trip on My Florida NEMT.`,
          ``,
          `Patient: ${trip.patient_first_name} ${trip.patient_last_name}${trip.patient_phone ? ` (${trip.patient_phone})` : ""}`,
          `When: ${trip.pickup_date} at ${String(trip.pickup_time).slice(0, 5)}`,
          `Pickup: ${trip.pickup_address}, ${trip.pickup_city}${trip.pickup_zip ? " " + trip.pickup_zip : ""}`,
          `Drop-off: ${trip.dropoff_address}, ${trip.dropoff_city}${trip.dropoff_zip ? " " + trip.dropoff_zip : ""}`,
          trip.transport_type ? `Transport: ${trip.transport_type}` : null,
          trip.round_trip ? `Round trip: yes` : null,
          trip.mobility_notes ? `Mobility: ${trip.mobility_notes}` : null,
          trip.special_instructions ? `Notes: ${trip.special_instructions}` : null,
        ].filter(Boolean).join("\n");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("notification_email_queue").insert({
          recipient_email: driver.email, subject, body,
        });
      }
    }
    return { ok: true };
  });

/* ---- Weekly schedule email to driver ---- */
export const sendDriverWeeklySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string; week_start: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: driver, error: dErr } = await supabase
      .from("drivers").select("first_name,email,owner_id")
      .eq("id", data.driver_id).eq("owner_id", userId).single();
    if (dErr || !driver) throw new Error("Driver not found");
    if (!driver.email) throw new Error("Driver has no email on file");

    const start = new Date(data.week_start + "T00:00:00");
    const end = new Date(start); end.setDate(end.getDate() + 7);
    const endStr = end.toISOString().slice(0, 10);

    const { data: trips, error: tErr } = await supabase
      .from("trips").select("*")
      .eq("driver_id", data.driver_id)
      .gte("pickup_date", data.week_start).lt("pickup_date", endStr)
      .order("pickup_date").order("pickup_time");
    if (tErr) throw tErr;

    const lines: string[] = [
      `Hi ${driver.first_name},`,
      ``,
      `Here is your trip schedule for the week of ${data.week_start}:`,
      ``,
    ];
    if (!trips || trips.length === 0) {
      lines.push("No trips assigned for this week.");
    } else {
      for (const t of trips) {
        lines.push(`— ${t.pickup_date} ${String(t.pickup_time).slice(0, 5)} · ${t.patient_first_name} ${t.patient_last_name}${t.patient_phone ? ` (${t.patient_phone})` : ""}`);
        lines.push(`   Pickup: ${t.pickup_address}, ${t.pickup_city}${t.pickup_zip ? " " + t.pickup_zip : ""}`);
        lines.push(`   Drop-off: ${t.dropoff_address}, ${t.dropoff_city}${t.dropoff_zip ? " " + t.dropoff_zip : ""}`);
        if (t.transport_type) lines.push(`   Transport: ${t.transport_type}${t.round_trip ? " · round trip" : ""}`);
        if (t.mobility_notes) lines.push(`   Mobility: ${t.mobility_notes}`);
        if (t.special_instructions) lines.push(`   Notes: ${t.special_instructions}`);
        lines.push("");
      }
    }
    lines.push("— My Florida NEMT");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: qErr } = await supabaseAdmin.from("notification_email_queue").insert({
      recipient_email: driver.email,
      subject: `Your My Florida NEMT schedule — week of ${data.week_start} (${trips?.length ?? 0} trip${(trips?.length ?? 0) === 1 ? "" : "s"})`,
      body: lines.join("\n"),
    });
    if (qErr) throw qErr;
    return { ok: true, count: trips?.length ?? 0 };
  });


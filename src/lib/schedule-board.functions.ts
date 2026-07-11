import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DayHours = { start: string; end: string; closed: boolean };
export type WeeklyHours = Record<"0" | "1" | "2" | "3" | "4" | "5" | "6", DayHours>;

const DEFAULT_WEEKLY: WeeklyHours = {
  "0": { start: "06:00", end: "20:00", closed: true },
  "1": { start: "06:00", end: "20:00", closed: false },
  "2": { start: "06:00", end: "20:00", closed: false },
  "3": { start: "06:00", end: "20:00", closed: false },
  "4": { start: "06:00", end: "20:00", closed: false },
  "5": { start: "06:00", end: "20:00", closed: false },
  "6": { start: "06:00", end: "20:00", closed: true },
};

function normalizeWeekly(raw: any): WeeklyHours {
  const out: any = { ...DEFAULT_WEEKLY };
  if (raw && typeof raw === "object") {
    for (const k of Object.keys(DEFAULT_WEEKLY)) {
      const v = raw[k];
      if (v && typeof v === "object") {
        out[k] = {
          start: typeof v.start === "string" ? v.start.slice(0, 5) : DEFAULT_WEEKLY[k as keyof WeeklyHours].start,
          end: typeof v.end === "string" ? v.end.slice(0, 5) : DEFAULT_WEEKLY[k as keyof WeeklyHours].end,
          closed: !!v.closed,
        };
      }
    }
  }
  return out as WeeklyHours;
}

/** Provider work hours — per day of week (0=Sun … 6=Sat) */
export const getMyWorkHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("member_profiles")
      .select("work_hours_weekly, work_hours_start, work_hours_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    const weekly = normalizeWeekly(data?.work_hours_weekly);
    return { weekly };
  });

export const saveMyWorkHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { weekly: WeeklyHours }) => input)
  .handler(async ({ data, context }) => {
    const weekly = normalizeWeekly(data.weekly);
    const { error } = await (context.supabase as any)
      .from("member_profiles")
      .update({ work_hours_weekly: weekly })
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/** List drivers owned by the current provider */
export const listMyDrivers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("drivers")
      .select("id, first_name, last_name, status")
      .eq("owner_id", context.userId)
      .order("first_name");
    if (error) throw error;
    return data ?? [];
  });

/** List the day's assigned-to-me reservations for the schedule board */
export const listReservationsForDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("ride_requests")
      .select("id, pickup_date, pickup_time, appointment_time, scheduled_start_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, round_trip, needs_wheelchair, service_level, assigned_driver_id, status")
      .eq("assigned_provider_id", context.userId)
      .eq("pickup_date", data.date)
      .order("pickup_time");
    if (error) throw error;
    return rows ?? [];
  });

/** Assign or clear a driver + scheduled time for a reservation */
export const assignDriverSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) => input)
  .handler(async ({ data, context }) => {
    const { data: r } = await context.supabase
      .from("ride_requests")
      .select("id, assigned_provider_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r || r.assigned_provider_id !== context.userId) {
      throw new Error("Reservation not found or not assigned to you");
    }
    if (data.driver_id) {
      const { data: d } = await context.supabase
        .from("drivers")
        .select("id, owner_id")
        .eq("id", data.driver_id)
        .maybeSingle();
      if (!d || d.owner_id !== context.userId) throw new Error("Driver not on your fleet");
    }
    const { error } = await context.supabase
      .from("ride_requests")
      .update({
        assigned_driver_id: data.driver_id,
        scheduled_start_time: data.scheduled_start_time,
      })
      .eq("id", data.reservation_id);
    if (error) throw error;
    return { ok: true };
  });

/** Reservations bucket for the Reservations page */
export const listMyReservations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { bucket: "past" | "current" | "future" }) => input)
  .handler(async ({ data, context }) => {
    const today = new Date().toISOString().slice(0, 10);
    let q = context.supabase
      .from("ride_requests")
      .select("id, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, patient_phone, patient_date_of_birth, patient_gender, pickup_address, pickup_city, pickup_zip, dropoff_address, dropoff_city, dropoff_zip, round_trip, transport_type, service_level, status, scheduled_start_time, assigned_driver_id, payer, medicaid_number, medicaid_plan, authorization_number, diagnosis_code, distance_miles, estimated_cost_cents, estimated_duration_seconds, estimated_duration_traffic_seconds, route_polyline, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng")
      .eq("assigned_provider_id", context.userId)
      .in("status", ["assigned", "confirmed", "en_route", "in_progress", "completed", "delivered"])
      .order("pickup_date", { ascending: data.bucket === "past" ? false : true });
    if (data.bucket === "past") q = q.lt("pickup_date", today);
    else if (data.bucket === "current") q = q.eq("pickup_date", today);
    else q = q.gt("pickup_date", today);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

/** Trips assigned to a specific driver for the next N days */
export const listDriverUpcomingTrips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string; days?: number }) => input)
  .handler(async ({ data, context }) => {
    const { data: driver } = await context.supabase
      .from("drivers")
      .select("id, first_name, last_name, email, phone, owner_id")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (!driver || driver.owner_id !== context.userId) throw new Error("Driver not on your fleet");
    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(); end.setDate(end.getDate() + (data.days ?? 7));
    const endIso = end.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("ride_requests")
      .select("id, pickup_date, pickup_time, scheduled_start_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, status, service_level")
      .eq("assigned_provider_id", context.userId)
      .eq("assigned_driver_id", data.driver_id)
      .gte("pickup_date", today)
      .lte("pickup_date", endIso)
      .order("pickup_date", { ascending: true })
      .order("pickup_time", { ascending: true });
    if (error) throw error;
    return { driver, trips: rows ?? [] };
  });

/** Email a driver their upcoming week's schedule */
export const emailDriverWeeklySchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { driver_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: driver } = await context.supabase
      .from("drivers")
      .select("id, first_name, last_name, email, owner_id")
      .eq("id", data.driver_id)
      .maybeSingle();
    if (!driver || driver.owner_id !== context.userId) throw new Error("Driver not on your fleet");
    if (!driver.email) throw new Error("Driver has no email on file. Add one in the Fleet panel.");

    const today = new Date().toISOString().slice(0, 10);
    const end = new Date(); end.setDate(end.getDate() + 7);
    const endIso = end.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("ride_requests")
      .select("pickup_date, pickup_time, scheduled_start_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, status")
      .eq("assigned_provider_id", context.userId)
      .eq("assigned_driver_id", data.driver_id)
      .gte("pickup_date", today)
      .lte("pickup_date", endIso)
      .order("pickup_date", { ascending: true })
      .order("pickup_time", { ascending: true });
    if (error) throw error;

    const trips = rows ?? [];
    const driverName = `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() || "Driver";
    const subject = `Your weekly schedule — ${trips.length} trip${trips.length === 1 ? "" : "s"}`;
    const lines: string[] = [
      `Hi ${driverName},`,
      "",
      `Here is your assigned schedule for the next 7 days (${today} → ${endIso}):`,
      "",
    ];
    if (trips.length === 0) {
      lines.push("You have no trips assigned in this window.");
    } else {
      let currentDate = "";
      for (const t of trips) {
        if (t.pickup_date !== currentDate) {
          currentDate = t.pickup_date;
          lines.push("");
          lines.push(`— ${currentDate} —`);
        }
        const time = ((t.scheduled_start_time ?? t.pickup_time) ?? "").toString().slice(0, 5);
        lines.push(
          `  • ${time}  ${t.patient_first_name ?? ""} ${t.patient_last_name ?? ""}`.trimEnd(),
        );
        lines.push(`      ${t.pickup_address ?? ""}, ${t.pickup_city ?? ""} → ${t.dropoff_address ?? ""}, ${t.dropoff_city ?? ""}`);
        if (t.status) lines.push(`      Status: ${t.status}`);
      }
    }
    lines.push("");
    lines.push("— My Florida NEMT");

    const body = lines.join("\n");
    const { error: qErr } = await (context.supabase as any)
      .from("notification_email_queue")
      .insert({ recipient_email: driver.email, subject, body });
    if (qErr) throw new Error(qErr.message);

    return { ok: true, trip_count: trips.length, recipient: driver.email };
  });


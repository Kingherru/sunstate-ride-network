import { z } from 'zod';
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
      .select("id, first_name, last_name, status, employment_type, availability, vacation_start, vacation_end, service_capabilities, primary_vehicle_id, regional_service_areas")
      .order("first_name");
    if (error) throw error;
    return data ?? [];
  });

/** List the day's assigned-to-me reservations for the schedule board */
export const listReservationsForDay = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { date: string }) => input)
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const { data: rows, error } = await context.supabase
      .from("trips")
      .select("id, network_distribution_id, updated_at, additional_stops, transport_type, ride_requests(service_line,child_care_details), pickup_state, dropoff_state, pickup_timezone, dropoff_timezone, regional_time_events, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, round_trip, needs_wheelchair, service_level, driver_id, vehicle_id, estimated_pickup_at, estimated_dropoff_at, estimated_duration_seconds, scheduled_start_time, assignment_end_time, status, reservation_state, assigned_to, created_by")
      .eq("pickup_date", data.date)
      .not("status", "in", "(completed,canceled,cancelled,no_show)")
      .order("pickup_time");
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      ...r,service_line:r.ride_requests?.service_line,child_care_details:r.ride_requests?.child_care_details,
      assigned_driver_id: r.driver_id,
      scheduled_start_time: r.scheduled_start_time ?? r.pickup_time,
    }));
  });

/** List an entire week (7 days starting from week_start ISO date) */
export const listReservationsForWeek = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { week_start: string }) => input)
  .handler(async ({ data, context }) => {
    const uid = context.userId;
    const start = new Date(data.week_start + "T00:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const endIso = end.toISOString().slice(0, 10);
    const { data: rows, error } = await context.supabase
      .from("trips")
      .select("id, network_distribution_id, updated_at, additional_stops, transport_type, ride_requests(service_line,child_care_details), pickup_state, dropoff_state, pickup_timezone, dropoff_timezone, regional_time_events, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, round_trip, needs_wheelchair, service_level, driver_id, vehicle_id, estimated_pickup_at, estimated_dropoff_at, estimated_duration_seconds, scheduled_start_time, assignment_end_time, status, reservation_state, assigned_to, created_by")
      .not("status", "in", "(completed,canceled,cancelled,no_show)")
      .gte("pickup_date", data.week_start)
      .lte("pickup_date", endIso)
      .order("pickup_date")
      .order("pickup_time");
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({
      ...r,service_line:r.ride_requests?.service_line,child_care_details:r.ride_requests?.child_care_details,
      assigned_driver_id: r.driver_id,
      scheduled_start_time: r.scheduled_start_time ?? r.pickup_time,
    }));
  });

/** Assign or clear a driver + scheduled time for a booked trip */
export const assignDriverSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) => input)
  .handler(async ({ data, context }) => {
    // The generated RPC types omit SQL's nullable arguments; null intentionally clears the slot.
    const { error } = await context.supabase.rpc('network_assign_driver_slot', { _trip: data.reservation_id, _driver: data.driver_id as never, _time: data.scheduled_start_time as never });
    if (error) throw error;
    try { const { notifyDriverAssignment } = await import('./driver-assignment-notify.server'); await notifyDriverAssignment(data.reservation_id); } catch { /* Notifications cannot invalidate a saved slot. */ }
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
      .select("id, pickup_state, dropoff_state, pickup_timezone, dropoff_timezone, regional_time_events, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, patient_phone, patient_date_of_birth, patient_gender, pickup_address, pickup_city, pickup_zip, dropoff_address, dropoff_city, dropoff_zip, round_trip, transport_type, service_level, status, scheduled_start_time, assigned_driver_id, payer, medicaid_number, medicaid_plan, authorization_number, diagnosis_code, distance_miles, estimated_cost_cents, estimated_duration_seconds, estimated_duration_traffic_seconds, route_polyline, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng")
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
      .select("id, pickup_state, dropoff_state, pickup_timezone, dropoff_timezone, regional_time_events, pickup_zip, dropoff_zip, pickup_date, pickup_time, scheduled_start_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, status, service_level")
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
    throw new Error("Driver email delivery is off. Use Schedule → Prepare driver trip logs.");
  });


/** Day/week/month board range (max 42 days). RLS decides which trips are visible. */
export const listReservationsForRange = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { start: string; end: string }) => {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(input.start) || !re.test(input.end) || input.end < input.start) throw new Error("Invalid date range");
    if ((Date.parse(input.end) - Date.parse(input.start)) / 86400000 > 42) throw new Error("Range too long");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trips")
      .select("id, network_distribution_id, updated_at, additional_stops, transport_type, ride_requests(service_line,child_care_details), pickup_state, dropoff_state, pickup_timezone, dropoff_timezone, regional_time_events, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, pickup_city, dropoff_city, needs_wheelchair, driver_id, vehicle_id, estimated_pickup_at, estimated_dropoff_at, estimated_duration_seconds, scheduled_start_time, assignment_end_time, status, reservation_state")
      .not("status", "in", "(completed,canceled,cancelled,no_show)")
      .gte("pickup_date", data.start).lte("pickup_date", data.end)
      .order("pickup_date").order("pickup_time");
    if (error) throw error;
    return (rows ?? []).map((r: any) => ({ ...r, assigned_driver_id: r.driver_id, scheduled_start_time: r.scheduled_start_time ?? r.pickup_time }));
  });

export const assignTripResources = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((v:unknown)=>z.object({tripId:z.string().uuid(),driverId:z.string().uuid().nullable(),vehicleId:z.string().uuid().nullable(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable()}).strict().parse(v))
 .handler(async({data,context})=>{const {error}=await context.supabase.rpc('assign_trip_resources',{_trip:data.tripId,_driver:data.driverId as never,_vehicle:data.vehicleId as never,_time:data.start,_end:data.end as never});if(error)throw new Error(error.message);try{const {notifyDriverAssignment}=await import('./driver-assignment-notify.server');await notifyDriverAssignment(data.tripId);}catch{/* Notification failures never invalidate a committed assignment. */}return {ok:true};});

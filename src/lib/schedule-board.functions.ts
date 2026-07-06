import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Provider work hours */
export const getMyWorkHours = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("member_profiles")
      .select("work_hours_start, work_hours_end")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return {
      start: (data?.work_hours_start as string | null) ?? "06:00",
      end: (data?.work_hours_end as string | null) ?? "20:00",
    };
  });

export const saveMyWorkHours = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { start: string; end: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("member_profiles")
      .update({ work_hours_start: data.start, work_hours_end: data.end })
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
    // ensure reservation belongs to caller
    const { data: r } = await context.supabase
      .from("ride_requests")
      .select("id, assigned_provider_id")
      .eq("id", data.reservation_id)
      .maybeSingle();
    if (!r || r.assigned_provider_id !== context.userId) {
      throw new Error("Reservation not found or not assigned to you");
    }
    // ensure the driver (if any) belongs to caller
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
      .select("id, pickup_date, pickup_time, appointment_time, patient_first_name, patient_last_name, pickup_address, pickup_city, dropoff_address, dropoff_city, round_trip, status, scheduled_start_time, assigned_driver_id")
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

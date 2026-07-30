import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Push the trip to the assigned provider's Duet dispatch account. */
export const syncTripToDuet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ trip_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip } = await supabase
      .from("trips")
      .select("id, assigned_to, created_by")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (!trip) return { ok: false as const, error: "Trip not found" };
    const { data: isOps } = await supabase.rpc("is_ops_staff", { _user_id: userId } as never);
    if (trip.assigned_to !== userId && trip.created_by !== userId && !isOps) {
      return { ok: false as const, error: "Forbidden" };
    }
    const { syncTripToDuetServer } = await import("@/lib/duet.server");
    return await syncTripToDuetServer(data.trip_id);
  });

/** Pull the latest Duet snapshot for a trip (status, driver, event history). */
export const pullTripFromDuet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ trip_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip } = await supabase
      .from("trips").select("id, assigned_to, created_by").eq("id", data.trip_id).maybeSingle();
    if (!trip) return { ok: false as const, error: "Trip not found" };
    const { data: isOps } = await supabase.rpc("is_ops_staff", { _user_id: userId } as never);
    if (trip.assigned_to !== userId && trip.created_by !== userId && !isOps) {
      return { ok: false as const, error: "Forbidden" };
    }
    const { refreshTripFromDuet } = await import("@/lib/duet.server");
    return await refreshTripFromDuet(data.trip_id);
  });

/** Timeline of dispatch-software activity for a trip (sent, received, errors). */
export const listTripDispatchEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ trip_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: trip } = await context.supabase
      .from("trips")
      .select("id, duet_ride_id, duet_synced_at, duet_last_event, duet_last_event_at")
      .eq("id", data.trip_id)
      .maybeSingle();
    const { data: rows, error } = await context.supabase
      .from("trip_dispatch_events")
      .select("id, vendor, event_type, event_time, external_ride_id, latitude, longitude, payload, created_at")
      .eq("trip_id", data.trip_id)
      .order("event_time", { ascending: false })
      .limit(200);
    if (error) throw error;
    return { trip: trip ?? null, events: rows ?? [] };
  });


const manualSchema = z.object({
  trip_id: z.string().uuid(),
  driver_arrived_at: z.string().min(1),
  actual_pickup_at: z.string().optional().nullable(),
  actual_dropoff_at: z.string().min(1),
  return_pickup_at: z.string().optional().nullable(),
  return_dropoff_at: z.string().optional().nullable(),
  wait_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  attested: z.literal(true, { message: "You must confirm the information submitted is accurate." }),
});

/**
 * Manual trip completion by the assigned provider (or ops staff) when the trip
 * was not closed out through dispatch software. Requires an accuracy
 * attestation and starts the 7-day payout validation window.
 */
export const completeTripManually = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => manualSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: trip } = await supabase
      .from("trips")
      .select("id, assigned_to, created_by, status, round_trip")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (!trip) return { ok: false as const, error: "Trip not found" };
    const { data: isOps } = await supabase.rpc("is_ops_staff", { _user_id: userId } as never);
    if (trip.assigned_to !== userId && !isOps) {
      return { ok: false as const, error: "Only the assigned provider can complete this trip." };
    }
    if (["completed", "canceled", "cancelled"].includes(String(trip.status ?? "").toLowerCase())) {
      return { ok: false as const, error: "This trip is already closed." };
    }

    const arrived = new Date(data.driver_arrived_at);
    const dropoff = new Date(data.actual_dropoff_at);
    if (Number.isNaN(arrived.getTime()) || Number.isNaN(dropoff.getTime())) {
      return { ok: false as const, error: "Enter valid arrival and drop-off times." };
    }
    if (dropoff.getTime() < arrived.getTime()) {
      return { ok: false as const, error: "Drop-off time cannot be before the driver arrival time." };
    }
    const pickupAt = data.actual_pickup_at ? new Date(data.actual_pickup_at) : null;
    const waitMinutes = data.wait_minutes ?? (pickupAt && !Number.isNaN(pickupAt.getTime())
      ? Math.max(0, Math.round((pickupAt.getTime() - arrived.getTime()) / 60000))
      : null);

    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("trips")
      .update({
        driver_arrived_at: arrived.toISOString(),
        actual_pickup_at: pickupAt && !Number.isNaN(pickupAt.getTime()) ? pickupAt.toISOString() : null,
        actual_dropoff_at: dropoff.toISOString(),
        return_pickup_at: data.return_pickup_at ? new Date(data.return_pickup_at).toISOString() : null,
        return_dropoff_at: data.return_dropoff_at ? new Date(data.return_dropoff_at).toISOString() : null,
        wait_minutes: waitMinutes,
        status: "completed",
        completed_at: now,
        completed_by: userId,
        manually_completed_at: now,
        manually_completed_by: userId,
        completion_source: "manual",
        completion_attested: true,
        completion_attested_at: now,
        completion_attested_by: userId,
      } as never)
      .eq("id", data.trip_id);
    if (error) return { ok: false as const, error: error.message };

    const { startPayoutValidationWindow } = await import("@/lib/payout-validation.server");
    const win = await startPayoutValidationWindow(data.trip_id);

    return { ok: true as const, eligibleAt: win.eligibleAt, validationDays: win.days };
  });

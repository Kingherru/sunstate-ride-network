// Server-only Duet dispatch helpers. NEVER import from client-reachable modules.
import {
  duetCreateRides,
  duetUpdateRides,
  duetGetRide,
  type DuetRide,
  type DuetEventType,
} from "@/lib/integrations/duetride";
import type { IntegrationConfig } from "@/lib/integrations/adapter";

/** Load + decrypt a provider's Duet connection. Returns null when not connected. */
export async function loadDuetConfig(providerId: string): Promise<IntegrationConfig | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("provider_integrations")
    .select("api_key_encrypted, webhook_secret, enabled, config")
    .eq("provider_id", providerId)
    .eq("vendor", "duetride")
    .maybeSingle();
  if (!data || !data.enabled || !data.api_key_encrypted) return null;

  const { decryptSecret } = await import("@/lib/integrations-crypto.server");
  const cfg = (data.config ?? {}) as Record<string, unknown>;
  let apiSecret: string | undefined;
  if (typeof cfg.apiSecretEncrypted === "string") {
    try { apiSecret = decryptSecret(cfg.apiSecretEncrypted); } catch { apiSecret = undefined; }
  }
  return {
    apiKey: decryptSecret(data.api_key_encrypted),
    webhookSecret: data.webhook_secret ? decryptSecret(data.webhook_secret) : undefined,
    baseUrl: (cfg.baseUrl as string) || undefined,
    config: { ...cfg, apiSecret },
  };
}

function toUtcIso(date?: string | null, time?: string | null): string {
  if (!date) return new Date().toISOString();
  const t = (time ?? "00:00").slice(0, 5);
  // Trip times are recorded in America/New_York; Florida is UTC-4/-5.
  const local = new Date(`${date}T${t}:00-04:00`);
  return Number.isNaN(local.getTime()) ? new Date().toISOString() : local.toISOString();
}

function vehicleType(transport?: string | null): string {
  switch ((transport ?? "").toLowerCase()) {
    case "wheelchair": return "Wheelchair";
    case "stretcher": return "Stretcher";
    default: return "Ambulatory";
  }
}

/** Map an internal trip row to a Duet Ride object. */
export function mapTripToDuetRide(t: any, transportationProviderId: string): DuetRide {
  const notes = [t.mobility_notes, t.special_instructions, t.notes, t.driver_notes]
    .filter(Boolean).join(" | ") || undefined;
  const isRound = !!t.round_trip;
  return {
    rideId: t.display_id || t.id,
    transportationProviderId,
    patientFirstName: t.patient_first_name ?? "",
    patientLastName: t.patient_last_name ?? "",
    patientPhone: t.patient_phone ?? undefined,
    patientId: t.patient_id || t.saved_patient_id || `mfn-${t.id}`,
    patientDOB: t.patient_date_of_birth ?? undefined,
    tripType: "A",
    pickupTime: toUtcIso(t.pickup_date, t.pickup_time),
    appointmentTime: t.appointment_time ? toUtcIso(t.pickup_date, t.appointment_time) : undefined,
    pickupAddressLine1: t.pickup_address ?? "",
    pickupAddressLine2: t.pickup_address_details ?? undefined,
    pickupCity: t.pickup_city ?? "",
    pickupState: t.pickup_state ?? "FL",
    pickupZipcode: t.pickup_zip ?? "",
    pickupCounty: t.pickup_county ?? undefined,
    pickupLatitude: Number(t.pickup_lat ?? 0),
    pickupLongitude: Number(t.pickup_lng ?? 0),
    dropoffAddressLine1: t.dropoff_address ?? "",
    dropoffCity: t.dropoff_city ?? "",
    dropoffState: t.dropoff_state ?? "FL",
    dropoffZipcode: t.dropoff_zip ?? "",
    dropoffCounty: t.dropoff_county ?? undefined,
    dropoffLatitude: Number(t.dropoff_lat ?? 0),
    dropoffLongitude: Number(t.dropoff_lng ?? 0),
    additionalPassenger: Number(t.additional_passengers ?? 0) || undefined,
    notes,
    chargeAmount: t.cost_total != null ? Number(t.cost_total) : undefined,
    mileage: t.distance_miles != null ? Number(t.distance_miles) : undefined,
    vehicleType: vehicleType(t.transport_type),
    // Return leg (round trips): patient goes back to the original pickup address.
    returnPickupTime: isRound ? toUtcIso(t.return_date ?? t.pickup_date, t.return_pickup_time) : undefined,
    returnAddressLine1: isRound ? (t.dropoff_address ?? undefined) : undefined,
    returnCity: isRound ? (t.dropoff_city ?? undefined) : undefined,
    returnState: isRound ? (t.dropoff_state ?? "FL") : undefined,
    returnZipcode: isRound ? (t.dropoff_zip ?? undefined) : undefined,
  };
}

/** Record an outbound sync attempt (success or failure) on the trip timeline. */
export async function logDuetSyncEvent(opts: {
  tripId: string;
  providerId?: string | null;
  eventType: string;
  externalRideId?: string | null;
  payload?: unknown;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("trip_dispatch_events").insert({
      trip_id: opts.tripId,
      provider_id: opts.providerId ?? null,
      vendor: "duetride",
      event_type: opts.eventType,
      external_ride_id: opts.externalRideId ?? null,
      event_time: new Date().toISOString(),
      payload: (opts.payload ?? {}) as never,
    });
  } catch {
    // Timeline logging must never break the sync itself.
  }
}

/** Push (create or update) a trip into the assigned provider's Duet account. */
export async function syncTripToDuetServer(tripId: string): Promise<{
  ok: boolean; rideId?: string; error?: string;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: trip } = await supabaseAdmin.from("trips").select("*").eq("id", tripId).maybeSingle();
  if (!trip) return { ok: false, error: "Trip not found" };
  const providerId = (trip as any).assigned_to;
  if (!providerId) return { ok: false, error: "Trip has no assigned provider" };

  const cfg = await loadDuetConfig(providerId);
  if (!cfg) return { ok: false, error: "This provider has not connected Duet (Integrations → Duet)." };

  const tpId = String(cfg.config?.transportationProviderId ?? "");
  if (!tpId) return { ok: false, error: "Missing Duet transportation provider ID in the integration settings." };

  const ride = mapTripToDuetRide(trip, tpId);
  try {
    if ((trip as any).duet_ride_id) await duetUpdateRides(cfg, [ride]);
    else await duetCreateRides(cfg, [ride]);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Duet request failed" };
  }

  await supabaseAdmin.from("trips").update({
    duet_ride_id: ride.rideId,
    duet_synced_at: new Date().toISOString(),
  }).eq("id", tripId);

  await supabaseAdmin.from("provider_integrations")
    .update({ last_sync_at: new Date().toISOString() })
    .eq("provider_id", providerId).eq("vendor", "duetride");

  return { ok: true, rideId: ride.rideId };
}

/** Pull the latest ride snapshot from Duet for a trip. */
export async function refreshTripFromDuet(tripId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: trip } = await supabaseAdmin
    .from("trips").select("id, assigned_to, duet_ride_id").eq("id", tripId).maybeSingle();
  if (!trip?.duet_ride_id || !trip.assigned_to) return { ok: false, error: "Trip is not synced with Duet" };
  const cfg = await loadDuetConfig(trip.assigned_to);
  if (!cfg) return { ok: false, error: "Duet is not connected for this provider" };
  try {
    const ride = await duetGetRide(cfg, trip.duet_ride_id);
    return { ok: true, ride };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Duet request failed" };
  }
}

/**
 * Apply an inbound Duet event to the trip record and log it.
 * Returns the trip id when matched.
 */
export async function applyDuetEvent(opts: {
  eventType: DuetEventType;
  payload: any;
}): Promise<{ ok: boolean; tripId?: string; error?: string }> {
  const { eventType, payload } = opts;
  const rideId = String(payload?.rideId ?? "");
  if (!rideId) return { ok: false, error: "Missing rideId" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id, assigned_to, status, wait_minutes, driver_arrived_at, actual_pickup_at, round_trip, completed_at")
    .eq("duet_ride_id", rideId)
    .maybeSingle();
  if (!trip) return { ok: false, error: "No trip matches that rideId" };

  const eventTime: string = payload?.eventTime ? new Date(payload.eventTime).toISOString() : new Date().toISOString();
  const patch: Record<string, unknown> = {
    duet_last_event: eventType,
    duet_last_event_at: eventTime,
  };

  switch (eventType) {
    case "rideScheduled":
      patch.status = "assigned";
      break;
    case "onTheWay":
      patch.status = "in_progress";
      break;
    case "pickupArrived":
      patch.driver_arrived_at = eventTime;
      patch.status = "in_progress";
      break;
    case "pickupCompleted": {
      patch.actual_pickup_at = eventTime;
      patch.status = "in_progress";
      const arrived = (trip as any).driver_arrived_at;
      if (arrived) {
        const mins = Math.max(0, Math.round((Date.parse(eventTime) - Date.parse(arrived)) / 60000));
        patch.wait_minutes = mins;
      }
      break;
    }
    case "dropoffArrived":
      patch.dropoff_arrived_at = eventTime;
      break;
    case "dropoffCompleted": {
      patch.actual_dropoff_at = eventTime;
      if ((trip as any).round_trip && (trip as any).actual_dropoff_at) {
        // second dropoff on a round trip closes the return leg
        patch.return_dropoff_at = eventTime;
      }
      patch.status = "completed";
      patch.completed_at = eventTime;
      patch.completion_source = "duet";
      break;
    }
    case "rideCanceled":
      patch.status = "canceled";
      patch.cancel_reason = payload?.reason ?? "Canceled in Duet";
      break;
    case "rideRejected":
      patch.status = "open";
      patch.assigned_to = null;
      break;
    case "noShow":
      patch.status = "no_show";
      patch.no_show_reason = payload?.reason ?? "Passenger no-show (Duet)";
      break;
    case "willCallInitiated":
      if (payload?.scheduledPickupTime) patch.duet_last_event_at = new Date(payload.scheduledPickupTime).toISOString();
      break;
    case "rideUnscheduled":
    case "gpsEvent":
    default:
      break;
  }

  await supabaseAdmin.from("trips").update(patch as never).eq("id", trip.id);

  await supabaseAdmin.from("trip_dispatch_events").insert({
    trip_id: trip.id,
    provider_id: (trip as any).assigned_to,
    vendor: "duetride",
    event_type: eventType,
    external_ride_id: rideId,
    event_time: eventTime,
    latitude: payload?.latitude ?? null,
    longitude: payload?.longitude ?? null,
    payload,
  });

  // A trip finished through Duet enters the 7-day payout validation window.
  if (patch.status === "completed") {
    const { startPayoutValidationWindow } = await import("@/lib/payout-validation.server");
    await startPayoutValidationWindow(trip.id);
  }

  return { ok: true, tripId: trip.id };
}

/**
 * Duet (Dashboard Story, Inc.) Broker Integration adapter.
 *
 * Broker → Duet:
 *   POST {baseUrl}/oauth2/token/    { apiKey, apiSecret }
 *   POST {baseUrl}/create-rides     [Ride]
 *   PUT  {baseUrl}/update-rides     [Ride]
 *   GET  {baseUrl}/get-ride/{rideId}
 *   GET  {baseUrl}/vehicle/locations
 *
 * Duet → Broker (inbound events) are handled by
 * src/routes/api/public/integrations/duet/events/$event.ts
 */
import type { IntegrationAdapter, IntegrationConfig, ExternalTrip } from "./adapter";

export const DUET_DEFAULT_BASE_URL = "https://api.duetride.com";

export type DuetRide = {
  rideId: string;
  transportationProviderId: string;
  patientFirstName: string;
  patientLastName: string;
  patientPhone?: string;
  patientId: string;
  patientDOB?: string;
  tripType: "A" | "B";
  pickupTime: string;
  appointmentTime?: string;
  pickupAddressLine1: string;
  pickupAddressLine2?: string;
  pickupCity: string;
  pickupState: string;
  pickupZipcode: string;
  pickupCounty?: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffAddressLine1: string;
  dropoffAddressLine2?: string;
  dropoffCity: string;
  dropoffState: string;
  dropoffZipcode: string;
  dropoffCounty?: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  additionalPassenger?: number;
  notes?: string;
  chargeAmount?: number;
  mileage?: number;
  vehicleType: string;
  /** Broker extension: return leg for round trips. */
  returnPickupTime?: string;
  returnAddressLine1?: string;
  returnCity?: string;
  returnState?: string;
  returnZipcode?: string;
};

function baseUrl(cfg: IntegrationConfig): string {
  const raw = (cfg.baseUrl || (cfg.config?.baseUrl as string) || DUET_DEFAULT_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

/** Exchange apiKey/apiSecret for a bearer token. */
export async function duetAuthToken(cfg: IntegrationConfig): Promise<string> {
  const res = await fetch(`${baseUrl(cfg)}/oauth2/token/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apiKey: cfg.apiKey,
      apiSecret: (cfg.config?.apiSecret as string) ?? cfg.webhookSecret ?? cfg.apiKey,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Duet auth failed [${res.status}]: ${text}`);
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  const token = json.accessToken ?? json.access_token ?? json.token ?? json?.data?.accessToken;
  if (!token) throw new Error("Duet auth response did not include an access token");
  return token as string;
}

async function duetFetch(cfg: IntegrationConfig, path: string, init: RequestInit = {}) {
  const token = await duetAuthToken(cfg);
  const res = await fetch(`${baseUrl(cfg)}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Duet request ${path} failed [${res.status}]: ${body}`);
  try { return JSON.parse(body); } catch { return {}; }
}

/** Create rides in Duet (max 100 per batch). */
export async function duetCreateRides(cfg: IntegrationConfig, rides: DuetRide[]) {
  return duetFetch(cfg, "/create-rides", { method: "POST", body: JSON.stringify(rides.slice(0, 100)) });
}

/** Update rides in Duet (max 50 per batch). */
export async function duetUpdateRides(cfg: IntegrationConfig, rides: DuetRide[]) {
  return duetFetch(cfg, "/update-rides", { method: "PUT", body: JSON.stringify(rides.slice(0, 50)) });
}

/** Fetch the latest state of a ride, including status + event history. */
export async function duetGetRide(cfg: IntegrationConfig, rideId: string) {
  return duetFetch(cfg, `/get-ride/${encodeURIComponent(rideId)}`, { method: "GET" });
}

/** GPS coordinates of idle vehicles. */
export async function duetVehicleLocations(cfg: IntegrationConfig) {
  return duetFetch(cfg, "/vehicle/locations", { method: "GET" });
}

/** Duet event names (Duet → Broker). */
export const DUET_EVENT_TYPES = [
  "rideScheduled",
  "rideUnscheduled",
  "willCallInitiated",
  "onTheWay",
  "pickupArrived",
  "pickupCompleted",
  "dropoffArrived",
  "dropoffCompleted",
  "rideCanceled",
  "rideRejected",
  "noShow",
  "gpsEvent",
] as const;
export type DuetEventType = (typeof DUET_EVENT_TYPES)[number];

/** URL slug (`/events/pickup-arrived`) → camelCase event name. */
export function duetEventFromSlug(slug: string): DuetEventType | null {
  const camel = slug.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
  return (DUET_EVENT_TYPES as readonly string[]).includes(camel) ? (camel as DuetEventType) : null;
}

export const duetrideAdapter: IntegrationAdapter = {
  vendor: "duetride",
  async pushTrip(trip: ExternalTrip, cfg: IntegrationConfig) {
    // Minimal mapping for the generic adapter surface; the richer mapping used
    // by the app lives in src/lib/duet.server.ts (it has the full trip row).
    const ride: DuetRide = {
      rideId: trip.external_id,
      transportationProviderId: String(cfg.config?.transportationProviderId ?? ""),
      patientFirstName: trip.patient_first_name,
      patientLastName: trip.patient_last_name,
      patientPhone: trip.patient_phone,
      patientId: trip.external_id,
      tripType: "A",
      pickupTime: new Date(`${trip.pickup_date}T${trip.pickup_time}:00Z`).toISOString(),
      pickupAddressLine1: trip.pickup_address,
      pickupCity: trip.pickup_city,
      pickupState: "FL",
      pickupZipcode: trip.pickup_zip ?? "",
      pickupLatitude: 0,
      pickupLongitude: 0,
      dropoffAddressLine1: trip.dropoff_address,
      dropoffCity: trip.dropoff_city,
      dropoffState: "FL",
      dropoffZipcode: trip.dropoff_zip ?? "",
      dropoffLatitude: 0,
      dropoffLongitude: 0,
      vehicleType: trip.transport_type === "wheelchair" ? "Wheelchair"
        : trip.transport_type === "stretcher" ? "Stretcher" : "Ambulatory",
    };
    await duetCreateRides(cfg, [ride]);
    return { external_id: ride.rideId };
  },
  async pullTrips() {
    // Duet pushes trip updates via events; there is no bulk pull endpoint.
    return [];
  },
  async verifyWebhook(_rawBody, signature, cfg) {
    const secret = cfg.webhookSecret;
    if (!secret || !signature) return false;
    const provided = signature.replace(/^Bearer\s+/i, "").trim();
    if (provided.length !== secret.length) return false;
    let diff = 0;
    for (let i = 0; i < secret.length; i++) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
    return diff === 0;
  },
  parseWebhook() {
    // Inbound Duet payloads are trip *events*, not trip records.
    return [];
  },
};

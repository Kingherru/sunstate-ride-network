import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function authHeaders() {
  const lk = process.env.LOVABLE_API_KEY;
  // Server-side Geocoding/Routes calls cannot use an HTTP-referrer-restricted browser key.
  const gk = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY_1;
  if (!lk || !gk) throw new Error("Google Maps connector not configured");
  return { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk };
}

async function geocode(address: string): Promise<{ lat: number; lng: number; zip: string | null } | null> {
  const r = await fetch(`${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}`, { headers: authHeaders() });
  if (!r.ok) return null;
  const j: any = await r.json();
  const top = j?.results?.[0];
  if (!top) return null;
  const zip = top.address_components?.find((c: any) => c.types?.includes("postal_code"))?.short_name ?? null;
  return { lat: top.geometry.location.lat, lng: top.geometry.location.lng, zip };
}

export type RouteInfo = {
  miles: number | null;
  duration_seconds: number | null;
  duration_traffic_seconds: number | null;
  polyline: string | null;
};

async function routeInfo(
  o: { lat: number; lng: number },
  d: { lat: number; lng: number },
  intermediates: { lat: number; lng: number }[] = [],
): Promise<RouteInfo> {
  const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.staticDuration,routes.polyline.encodedPolyline",
    },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
      destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
      intermediates: intermediates.map((p) => ({
        location: { latLng: { latitude: p.lat, longitude: p.lng } },
      })),
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      polylineQuality: "OVERVIEW",
    }),
  });
  if (!r.ok) return { miles: null, duration_seconds: null, duration_traffic_seconds: null, polyline: null };
  const j: any = await r.json();
  const top = j?.routes?.[0];
  const meters: number | undefined = top?.distanceMeters;
  const parseDur = (v: unknown): number | null => {
    if (typeof v !== "string") return null;
    const m = v.match(/^(\d+(?:\.\d+)?)s$/);
    return m ? Math.round(parseFloat(m[1])) : null;
  };
  return {
    miles: typeof meters === "number" ? +(meters / 1609.344).toFixed(2) : null,
    duration_seconds: parseDur(top?.staticDuration),
    duration_traffic_seconds: parseDur(top?.duration),
    polyline: typeof top?.polyline?.encodedPolyline === "string" ? top.polyline.encodedPolyline : null,
  };
}

// MyFloridaNemt.com average pricing defaults (used when a provider hasn't set their own pricing).
// Ranges reflect typical Florida Medicaid / private-pay rates; midpoint is used for estimates.
export const FL_DEFAULTS = {
  ambulatory: { load: 50,  loadMax: 50,  perMileMin: 1.50, perMileMax: 3.50 },
  wheelchair: { load: 60,  loadMax: 60,  perMileMin: 2.00, perMileMax: 5.00 },
  gurney:     { load: 100, loadMax: 200, perMileMin: 4.50, perMileMax: 4.50 },
};
// Wait time: $15 per 30 minutes = $0.50/min
export const FL_WAIT_PER_MIN = 0.5;

export function estimateCostCents(transportType: string | null | undefined, miles: number): number {
  const k = (transportType ?? "ambulatory") as keyof typeof FL_DEFAULTS;
  const r = FL_DEFAULTS[k] ?? FL_DEFAULTS.ambulatory;
  const loadMid = (r.load + r.loadMax) / 2;
  const mileMid = (r.perMileMin + r.perMileMax) / 2;
  return Math.round((loadMid + mileMid * miles) * 100);
}

/** Geocode pickup & dropoff for a public ride request, compute miles + duration + polyline + estimate, then write back.
 *  Callers must present a short-lived enrichment token issued by submitRideRequest so anonymous visitors
 *  can't harvest data or trigger paid Maps calls against arbitrary ride_request UUIDs.
 */
export const enrichRideRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), token: z.string().min(10).max(400) }).parse(i),
  )
  .handler(async ({ data }) => {
    const { verifyEnrichmentToken } = await import("@/lib/enrichment-token.server");
    if (!verifyEnrichmentToken(data.id, data.token)) {
      return { ok: false as const, error: "invalid_token" };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: req, error } = await supabaseAdmin
      .from("ride_requests")
      .select("id,pickup_address,pickup_city,dropoff_address,dropoff_city,transport_type")
      .eq("id", data.id).single();
    if (error || !req) return { ok: false as const, error: "not_found" };

    const pickupStr = [req.pickup_address, req.pickup_city, "FL"].filter(Boolean).join(", ");
    const dropoffStr = [req.dropoff_address, req.dropoff_city, "FL"].filter(Boolean).join(", ");
    const [p, d] = await Promise.all([geocode(pickupStr), geocode(dropoffStr)]);
    if (!p || !d) return { ok: false as const, error: "geocode_failed" };
    const info = await routeInfo(p, d);
    const cents = info.miles != null ? estimateCostCents(req.transport_type, info.miles) : null;

    await supabaseAdmin.from("ride_requests").update({
      pickup_lat: p.lat, pickup_lng: p.lng, pickup_zip: p.zip,
      dropoff_lat: d.lat, dropoff_lng: d.lng,
      distance_miles: info.miles,
      estimated_cost_cents: cents,
      estimated_duration_seconds: info.duration_seconds,
      estimated_duration_traffic_seconds: info.duration_traffic_seconds,
      route_polyline: info.polyline,
      route_computed_at: new Date().toISOString(),
    } as any).eq("id", data.id);

    return {
      ok: true as const,
      miles: info.miles,
      duration_seconds: info.duration_seconds,
      duration_traffic_seconds: info.duration_traffic_seconds,
      polyline: info.polyline,
      estimated_cost_cents: cents,
      pickup_zip: p.zip,
      pickup_lat: p.lat,
      pickup_lng: p.lng,
      dropoff_lat: d.lat,
      dropoff_lng: d.lng,
    };
  });

/** Geocode a single address string (used by the provider Network panel to set their service center).
 *  Requires an authenticated session so anonymous callers can't burn the Google Maps quota. */
export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ address: z.string().min(3).max(300) }).parse(i))
  .handler(async ({ data }) => {
    const g = await geocode(data.address);
    if (!g) return { ok: false as const, error: "geocode_failed" };
    return { ok: true as const, ...g };
  });


import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

function authHeaders() {
  const lk = process.env.LOVABLE_API_KEY;
  const gk = process.env.GOOGLE_MAPS_API_KEY;
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

async function routeMiles(o: { lat: number; lng: number }, d: { lat: number; lng: number }): Promise<number | null> {
  const r = await fetch(`${GATEWAY}/routes/directions/v2:computeRoutes`, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json", "X-Goog-FieldMask": "routes.distanceMeters" },
    body: JSON.stringify({
      origin: { location: { latLng: { latitude: o.lat, longitude: o.lng } } },
      destination: { location: { latLng: { latitude: d.lat, longitude: d.lng } } },
      travelMode: "DRIVE",
    }),
  });
  if (!r.ok) return null;
  const j: any = await r.json();
  const meters = j?.routes?.[0]?.distanceMeters;
  return typeof meters === "number" ? +(meters / 1609.344).toFixed(2) : null;
}

// Florida NEMT average pricing defaults (used when a provider hasn't set their own pricing).
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

/** Geocode pickup & dropoff for a public ride request, compute miles + estimate, then write back. */
export const enrichRideRequest = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
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
    const miles = await routeMiles(p, d);
    const cents = miles != null ? estimateCostCents(req.transport_type, miles) : null;

    await supabaseAdmin.from("ride_requests").update({
      pickup_lat: p.lat, pickup_lng: p.lng, pickup_zip: p.zip,
      dropoff_lat: d.lat, dropoff_lng: d.lng,
      distance_miles: miles, estimated_cost_cents: cents,
    }).eq("id", data.id);

    return { ok: true as const, miles, estimated_cost_cents: cents, pickup_zip: p.zip };
  });

/** Geocode a single address string (used by the provider Network panel to set their service center). */
export const geocodeAddress = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ address: z.string().min(3).max(300) }).parse(i))
  .handler(async ({ data }) => {
    const g = await geocode(data.address);
    if (!g) return { ok: false as const, error: "geocode_failed" };
    return { ok: true as const, ...g };
  });

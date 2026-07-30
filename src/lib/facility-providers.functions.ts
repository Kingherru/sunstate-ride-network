import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

async function geocode(address: string): Promise<{ lat: number; lng: number; zip: string | null } | null> {
  const lk = process.env.LOVABLE_API_KEY;
  // Server-side Geocoding calls cannot use an HTTP-referrer-restricted browser key.
  const gk = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY_1;
  if (!lk || !gk) return null;
  const r = await fetch(`${GATEWAY}/maps/api/geocode/json?address=${encodeURIComponent(address)}`, {
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": gk },
  });
  if (!r.ok) return null;
  const j: any = await r.json();
  const top = j?.results?.[0];
  if (!top) return null;
  const zip = top.address_components?.find((c: any) => c.types?.includes("postal_code"))?.short_name ?? null;
  return { lat: top.geometry.location.lat, lng: top.geometry.location.lng, zip };
}

function miles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(s));
}

export type ProviderLookupRow = {
  user_id: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  region: string | null;
  phone: string | null;
  dispatch_email: string | null;
  postal_code: string | null;
  service_radius_miles: number | null;
  medicaid_verified: boolean;
  zone_name: string | null;
  /** "zip" = ZIP is in the provider's saved service area, "zone" = same dispatch zone, "long_distance" = covers long-distance trips */
  match_type: "zip" | "zone" | "long_distance";
  distance_miles: number | null;
  est_drive_miles: number | null;
  est_fare_low_cents: number | null;
  est_fare_high_cents: number | null;
  is_saved: boolean;
};

function extractZip(input: string): string | null {
  const m = input.match(/\b(\d{5})(?:-\d{4})?\b/);
  return m ? m[1] : null;
}

/**
 * Find eligible providers for a pickup ZIP code (or address containing one).
 * Eligibility comes from the provider's saved service area (preferred ZIP codes,
 * business ZIP, dispatch zone, long-distance flag), approval status and active
 * membership — enforced server-side by `search_providers_by_zip`.
 */
export const findProvidersNearAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ address: z.string().min(3).max(300), radius_miles: z.number().min(1).max(150).default(50) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; zip: string; center: { lat: number; lng: number } | null; results: ProviderLookupRow[] } | { ok: false; error: string }> => {
    let zip = extractZip(data.address);
    let center: { lat: number; lng: number } | null = null;

    // Only geocode when the input isn't already a ZIP (keeps ZIP search working
    // even when the maps connector is unavailable).
    if (!zip || !/^\d{5}(-\d{4})?$/.test(data.address.trim())) {
      const g = await geocode(data.address);
      if (g) {
        center = { lat: g.lat, lng: g.lng };
        zip = zip ?? g.zip;
      }
    }
    if (!zip) return { ok: false, error: "no_zip" };

    const { data: matches, error } = await context.supabase.rpc("search_providers_by_zip", { _zip: zip });
    if (error) return { ok: false, error: error.message };

    const saved = await context.supabase
      .from("facility_saved_providers")
      .select("provider_user_id")
      .eq("facility_user_id", context.userId);
    const savedSet = new Set((saved.data ?? []).map((s: any) => s.provider_user_id));

    const rows: ProviderLookupRow[] = (matches ?? []).map((p: any) => {
      let distance: number | null = null;
      let driveMiles: number | null = null;
      let low: number | null = null;
      let high: number | null = null;
      if (center && p.center_lat != null && p.center_lng != null) {
        const d = miles(center, { lat: Number(p.center_lat), lng: Number(p.center_lng) });
        distance = +d.toFixed(1);
        driveMiles = +(d * 1.25).toFixed(1);
        low = Math.round((50 + 1.5 * driveMiles) * 100);
        high = Math.round((50 + 3.5 * driveMiles) * 100);
      }
      return {
        user_id: p.user_id,
        company_name: p.company_name,
        first_name: p.first_name,
        last_name: p.last_name,
        city: p.city,
        region: p.region,
        phone: p.phone,
        dispatch_email: p.dispatch_email,
        postal_code: p.postal_code,
        service_radius_miles: p.service_radius_miles,
        medicaid_verified: !!p.medicaid_verified,
        zone_name: p.zone_name ?? null,
        match_type: (p.match_type ?? "long_distance") as ProviderLookupRow["match_type"],
        distance_miles: distance,
        est_drive_miles: driveMiles,
        est_fare_low_cents: low,
        est_fare_high_cents: high,
        is_saved: savedSet.has(p.user_id),
      };
    })
      // Direct ZIP/zone coverage always shows; long-distance-only providers are
      // limited to the selected radius when we know how far away they are.
      .filter((r) => r.match_type !== "long_distance" || r.distance_miles == null || r.distance_miles <= data.radius_miles);

    return { ok: true, zip, center, results: rows };
  });


/** List saved providers for the current facility, with profile info. */
export const listSavedProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: saved, error } = await context.supabase
      .from("facility_saved_providers")
      .select("id, provider_user_id, notes, created_at")
      .eq("facility_user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!saved?.length) return [];
    const ids = saved.map((s: any) => s.provider_user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profs } = await supabaseAdmin
      .from("member_profiles")
      .select("user_id, company_name, first_name, last_name, city, region, phone, dispatch_email")
      .in("user_id", ids);
    const byId = new Map((profs ?? []).map((p: any) => [p.user_id, p]));
    return saved.map((s: any) => ({ ...s, profile: byId.get(s.provider_user_id) ?? null }));
  });

export const saveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ provider_user_id: z.string().uuid(), notes: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("facility_saved_providers")
      .upsert({ facility_user_id: context.userId, provider_user_id: data.provider_user_id, notes: data.notes ?? null }, { onConflict: "facility_user_id,provider_user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsaveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ provider_user_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("facility_saved_providers")
      .delete()
      .eq("facility_user_id", context.userId)
      .eq("provider_user_id", data.provider_user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Return the set of provider_user_ids the current facility has saved (for badges in trip history). */
export const listSavedProviderIds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("facility_saved_providers")
      .select("provider_user_id")
      .eq("facility_user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.provider_user_id as string);
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

async function geocode(address: string): Promise<{ lat: number; lng: number; zip: string | null } | null> {
  const lk = process.env.LOVABLE_API_KEY;
  // Prefer the custom-domain Google Maps connection when present; fall back to the original connection.
  const gk = process.env.GOOGLE_MAPS_API_KEY_1 || process.env.GOOGLE_MAPS_API_KEY;
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
  service_radius_miles: number | null;
  distance_miles: number;
  est_drive_miles: number;
  est_fare_low_cents: number;
  est_fare_high_cents: number;
  is_saved: boolean;
};

/** Find approved NEMT providers within 50 miles of an address. */
export const findProvidersNearAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ address: z.string().min(3).max(300), radius_miles: z.number().min(1).max(150).default(50) }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; center: { lat: number; lng: number }; results: ProviderLookupRow[] } | { ok: false; error: string }> => {
    const g = await geocode(data.address);
    if (!g) return { ok: false, error: "geocode_failed" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // approved providers with geocoded service center
    const { data: profs, error } = await supabaseAdmin
      .from("member_profiles")
      .select("user_id, company_name, first_name, last_name, city, region, service_radius_miles, center_lat, center_lng, dispatch_email")
      .not("center_lat", "is", null)
      .not("center_lng", "is", null);
    if (error) return { ok: false, error: error.message };

    // approved provider emails
    const { data: apps } = await supabaseAdmin
      .from("provider_applications")
      .select("email")
      .eq("status", "approved");
    const approvedEmails = new Set((apps ?? []).map((a: any) => (a.email ?? "").toLowerCase()));

    const saved = await context.supabase
      .from("facility_saved_providers")
      .select("provider_user_id")
      .eq("facility_user_id", context.userId);
    const savedSet = new Set((saved.data ?? []).map((s: any) => s.provider_user_id));

    const center = { lat: g.lat, lng: g.lng };
    const rows: ProviderLookupRow[] = (profs ?? [])
      .filter((p: any) => approvedEmails.has((p.dispatch_email ?? "").toLowerCase()))
      .map((p: any) => {
        const d = miles(center, { lat: Number(p.center_lat), lng: Number(p.center_lng) });
        // Approximate driving miles from straight-line distance (typical FL road factor ~1.25)
        const driveMiles = +(d * 1.25).toFixed(1);
        const amb = { loadMin: 50, loadMax: 50, mileMin: 1.5, mileMax: 3.5 };
        const low = Math.round((amb.loadMin + amb.mileMin * driveMiles) * 100);
        const high = Math.round((amb.loadMax + amb.mileMax * driveMiles) * 100);
        return {
          user_id: p.user_id,
          company_name: p.company_name,
          first_name: p.first_name,
          last_name: p.last_name,
          city: p.city,
          region: p.region,
          service_radius_miles: p.service_radius_miles,
          distance_miles: +d.toFixed(1),
          est_drive_miles: driveMiles,
          est_fare_low_cents: low,
          est_fare_high_cents: high,
          is_saved: savedSet.has(p.user_id),
        };
      })
      .filter((r) => r.distance_miles <= data.radius_miles)
      .sort((a, b) => a.distance_miles - b.distance_miles);

    return { ok: true, center, results: rows };
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

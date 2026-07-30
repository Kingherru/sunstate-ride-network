import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function requireAdmin(context: any) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Forbidden: only Administrators can modify dispatch zone ZIP codes.");
}

/* ---------- Dispatch Zones ---------- */

export const listDispatchZones = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dispatch_zones")
      .select("id, code, name, sort_order")
      .eq("kind", "region")
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
  });

/** Counties (the middle tier of Zone → County → ZIPs), with their parent region. */
export const listDispatchCounties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dispatch_zones")
      .select("id, code, name, region_id")
      .eq("kind", "county")
      .order("name");
    if (error) throw error;
    return (data ?? []) as Array<{
      id: string;
      code: string;
      name: string;
      region_id: string | null;
    }>;
  });

/** Per-county rollup (ZIPs, providers, facilities, patients, active trips). */
export const listDispatchCountyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("dispatch_county_stats", { _region_id: null as unknown as string });
    if (error) throw error;
    return (data ?? []) as Array<{
      county_id: string; code: string; name: string;
      region_id: string | null; region_code: string | null;
      zip_count: number; providers: number; facilities: number;
      patients: number; active_trips: number;
    }>;
  });

export const listDispatchZoneStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("dispatch_zone_stats");
    if (error) throw error;
    return (data ?? []) as Array<{
      zone_id: string; code: string; name: string; sort_order: number;
      zip_count: number; providers: number; facilities: number;
      patients: number; active_trips: number;
      managers: Array<{ user_id: string; name: string; email: string | null }>;
    }>;
  });

export const listZoneZips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("dispatch_zone_zips")
      .select("zip, zone_id, county_id")
      .order("zip");
    if (error) throw error;
    return (data ?? []) as Array<{ zip: string; zone_id: string; county_id: string | null }>;
  });

/** Admin: move an entire county (and all of its ZIPs) into another dispatch zone. */
export const moveCountyToZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ county_id: z.string().uuid(), zone_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error: cErr } = await context.supabase
      .from("dispatch_zones")
      .update({ region_id: data.zone_id })
      .eq("id", data.county_id)
      .eq("kind", "county");
    if (cErr) throw cErr;

    const { data: moved, error: zErr } = await context.supabase
      .from("dispatch_zone_zips")
      .update({ zone_id: data.zone_id })
      .eq("county_id", data.county_id)
      .select("zip");
    if (zErr) throw zErr;

    const zips = (moved ?? []).map((r: { zip: string }) => r.zip);
    if (zips.length) {
      const { error: tErr } = await context.supabase
        .from("trips")
        .update({ dispatch_zone_id: data.zone_id })
        .in("pickup_zip", zips);
      if (tErr) console.error("Trip re-route failed:", tErr);
    }
    return { moved: zips.length };
  });

/** Admin: attach one or more ZIPs to a county (and its parent zone). */
export const assignZipsToCounty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        county_id: z.string().uuid(),
        zips: z.array(z.string().regex(/^\d{5}$/)).min(1).max(2000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: county, error: cErr } = await context.supabase
      .from("dispatch_zones")
      .select("id, region_id")
      .eq("id", data.county_id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!county?.region_id) throw new Error("That county is not attached to a dispatch zone yet.");

    const rows = data.zips.map((zip) => ({
      zip,
      county_id: data.county_id,
      zone_id: county.region_id as string,
    }));
    const { error } = await context.supabase
      .from("dispatch_zone_zips")
      .upsert(rows, { onConflict: "zip" });
    if (error) throw error;

    const { error: tErr } = await context.supabase
      .from("trips")
      .update({ dispatch_zone_id: county.region_id })
      .in("pickup_zip", data.zips);
    if (tErr) console.error("Trip re-route failed:", tErr);

    return { count: rows.length };
  });


const assignZipsSchema = z.object({
  zone_id: z.string().uuid(),
  zips: z.array(z.string().regex(/^\d{5}$/)).min(1).max(2000),
});

export const assignZipsToZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => assignZipsSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const rows = data.zips.map((zip) => ({ zip, zone_id: data.zone_id }));
    const { error } = await context.supabase
      .from("dispatch_zone_zips")
      .upsert(rows, { onConflict: "zip" });
    if (error) throw error;

    // Re-route any trips whose pickup ZIP now maps to this zone
    const { error: updErr } = await context.supabase
      .from("trips")
      .update({ dispatch_zone_id: data.zone_id })
      .in("pickup_zip", data.zips);
    if (updErr) console.error("Trip re-route failed:", updErr);

    return { count: rows.length };
  });

export const removeZipFromZone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { zip: string }) => input)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { error } = await context.supabase
      .from("dispatch_zone_zips")
      .delete()
      .eq("zip", data.zip);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- ZIP fallback settings ---------- */

export const getZipFallbackSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select("zip_fallback_mode, zip_fallback_zone_id")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    return {
      mode: (data?.zip_fallback_mode ?? "manual_review") as "manual_review" | "default_zone",
      zoneId: (data?.zip_fallback_zone_id ?? null) as string | null,
    };
  });

const fallbackSchema = z.object({
  mode: z.enum(["manual_review", "default_zone"]),
  zoneId: z.string().uuid().nullable(),
});

export const updateZipFallbackSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => fallbackSchema.parse(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.mode === "default_zone" && !data.zoneId) {
      throw new Error("Pick a default zone or switch to manual review.");
    }
    const { error } = await context.supabase
      .from("platform_settings")
      .update({
        zip_fallback_mode: data.mode,
        zip_fallback_zone_id: data.mode === "default_zone" ? data.zoneId : null,
      })
      .eq("id", true);
    if (error) throw error;
    return { ok: true };
  });

export const listUnmappedZips = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_unmapped_zips");
    if (error) throw error;
    return (data ?? []) as Array<{
      zip: string;
      trip_count: number;
      provider_count: number;
      facility_count: number;
      patient_count: number;
    }>;
  });


/* ---------- Trip lookup ---------- */

export const findTripByDisplayId = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { display_id: string }) => input)
  .handler(async ({ data, context }) => {
    const q = data.display_id.trim().toUpperCase();
    const { data: row, error } = await context.supabase
      .from("trips")
      .select("*")
      .ilike("display_id", q)
      .maybeSingle();
    if (error) throw error;
    return row;
  });

export const listTripsByZone = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { zone_id?: string | null }) => input)
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("trips")
      .select("id, display_id, pickup_date, pickup_time, patient_first_name, patient_last_name, pickup_city, pickup_zip, dropoff_city, status, dispatch_zone_id, cost_total, referral_fee_cents, platform_fee_cents, provider_payout_cents, payment_status, payout_status, source, created_by, assigned_to, referral_status, referral_target_id, referral_sent_at")
      .order("pickup_date", { ascending: false })
      .limit(200);
    if (data.zone_id) query = query.eq("dispatch_zone_id", data.zone_id);
    else if (data.zone_id === null) query = query.is("dispatch_zone_id", null);
    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows || rows.length === 0) return [] as any[];

    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.created_by, r.assigned_to, r.referral_target_id].filter(Boolean))
    )) as string[];
    const nameMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: prof } = await context.supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, company_name")
        .in("user_id", userIds);
      for (const p of (prof ?? []) as any[]) {
        nameMap[p.user_id] = p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.user_id.slice(0, 8);
      }
    }
    return rows.map((r: any) => ({
      ...r,
      original_provider_name: r.created_by ? (nameMap[r.created_by] ?? null) : null,
      assigned_provider_name: r.assigned_to ? (nameMap[r.assigned_to] ?? null) : null,
      referral_target_name: r.referral_target_id ? (nameMap[r.referral_target_id] ?? null) : null,
    }));

  });

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
      .order("sort_order");
    if (error) throw error;
    return data ?? [];
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
      .select("zip, zone_id")
      .order("zip");
    if (error) throw error;
    return data ?? [];
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
      .select("id, display_id, pickup_date, pickup_time, patient_first_name, patient_last_name, pickup_city, pickup_zip, dropoff_city, status, dispatch_zone_id, cost_total, referral_fee_cents, platform_fee_cents, provider_payout_cents, payment_status, payout_status, source, created_by, assigned_to")
      .order("pickup_date", { ascending: false })
      .limit(200);
    if (data.zone_id) query = query.eq("dispatch_zone_id", data.zone_id);
    else if (data.zone_id === null) query = query.is("dispatch_zone_id", null);
    const { data: rows, error } = await query;
    if (error) throw error;
    if (!rows || rows.length === 0) return [] as any[];

    const userIds = Array.from(new Set(
      rows.flatMap((r: any) => [r.created_by, r.assigned_to].filter(Boolean))
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
    }));
  });

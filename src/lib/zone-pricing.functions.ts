import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Platform-wide fallback used when a zone doesn't yet have enough providers.
// Deliberately conservative — beats showing $0 when the network is empty.
export const DEFAULT_ZONE_PRICING = {
  base_pickup: 50,
  per_mile: 3,
  minimum_fare: 50,
  wheelchair_addon: 15,
  stretcher_addon: 40,
} as const;

const MIN_PROVIDERS_FOR_AVG = 3;

function serverClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export type FareLine = { label: string; amount: number };

function computeFareBreakdown(
  p: {
    base_pickup: number;
    per_mile: number;
    minimum_fare: number;
    wheelchair_addon?: number;
    stretcher_addon?: number;
  },
  miles: number,
  transport: "ambulatory" | "wheelchair" | "gurney",
  legs: number,
  waitMinutes: number,
  waitPerHour: number,
): { lines: FareLine[]; total: number } {
  const base = Number(p.base_pickup) || 0;
  const mile = Number(p.per_mile) || 0;
  const min = Number(p.minimum_fare) || 0;
  const addon =
    transport === "wheelchair" ? Number(p.wheelchair_addon) || 0 :
    transport === "gurney" ? Number(p.stretcher_addon) || 0 : 0;
  const lgs = Math.max(1, Math.floor(legs || 1));
  const mi = Math.max(0, miles);
  const lines: FareLine[] = [];
  if (base > 0) lines.push({ label: `Pickup fee × ${lgs}`, amount: +(base * lgs).toFixed(2) });
  if (mi > 0 && mile > 0) lines.push({ label: `Mileage (${mi.toFixed(1)} mi × $${mile.toFixed(2)})`, amount: +(mile * mi).toFixed(2) });
  if (addon > 0) lines.push({ label: `${transport === "gurney" ? "Stretcher" : "Wheelchair"} add-on`, amount: +addon.toFixed(2) });
  if (waitMinutes > 0 && waitPerHour > 0) {
    const hrs = Math.ceil(waitMinutes / 60);
    lines.push({ label: `Wait time (${hrs} hr × $${waitPerHour.toFixed(2)})`, amount: +(hrs * waitPerHour).toFixed(2) });
  }
  let total = +lines.reduce((a, l) => a + l.amount, 0).toFixed(2);
  if (total < min) {
    lines.push({ label: "Minimum fare adjustment", amount: +(min - total).toFixed(2) });
    total = min;
  }
  return { lines, total: +total.toFixed(2) };
}

const inputSchema = z.object({
  pickupZip: z.string().trim().max(10).optional().or(z.literal("")),
  zoneId: z.string().uuid().optional().or(z.literal("")),
  miles: z.number().min(0).max(2000).default(10),
  transportType: z.enum(["ambulatory", "wheelchair", "gurney"]).default("ambulatory"),
  providerId: z.string().uuid().optional().or(z.literal("")),
  legs: z.number().int().min(1).max(20).default(1),
  waitMinutes: z.number().min(0).max(1440).default(0),
});

export type ZonePriceEstimate = {
  zone: { id: string | null; name: string | null; providerCount: number } | null;
  zoneAverage: { dollars: number; usingDefault: boolean; lines: FareLine[] };
  provider: { id: string; dollars: number; lines: FareLine[] } | null;
  miles: number;
  legs: number;
  waitMinutes: number;
  transportType: "ambulatory" | "wheelchair" | "gurney";
};

export const estimateTripPrice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ data }): Promise<ZonePriceEstimate> => {
    const sb = serverClient();
    const miles = data.miles || 0;
    const legs = data.legs || 1;
    const waitMinutes = data.waitMinutes || 0;

    let zoneId = data.zoneId || null;
    if (!zoneId && data.pickupZip) {
      const zip5 = data.pickupZip.replace(/\D/g, "").slice(0, 5);
      if (zip5.length === 5) {
        const { data: row } = await sb
          .from("dispatch_zone_zips")
          .select("zone_id")
          .eq("zip", zip5)
          .maybeSingle();
        zoneId = (row as any)?.zone_id ?? null;
      }
    }

    let zone: ZonePriceEstimate["zone"] = null;
    let zoneSrc: {
      base_pickup: number; per_mile: number; minimum_fare: number;
      wheelchair_addon?: number; stretcher_addon?: number;
    } = { ...DEFAULT_ZONE_PRICING };
    let usingDefault = true;

    if (zoneId) {
      const { data: agg } = await sb
        .from("zone_pricing_averages" as any)
        .select("zone_id, zone_name, provider_count, avg_base_pickup, avg_per_mile, avg_minimum_fare, avg_wheelchair_addon, avg_stretcher_addon")
        .eq("zone_id", zoneId)
        .maybeSingle();
      const row: any = agg;
      const count = Number(row?.provider_count || 0);
      zone = { id: zoneId, name: row?.zone_name ?? null, providerCount: count };
      if (count >= MIN_PROVIDERS_FOR_AVG) {
        zoneSrc = {
          base_pickup: Number(row.avg_base_pickup ?? DEFAULT_ZONE_PRICING.base_pickup),
          per_mile: Number(row.avg_per_mile ?? DEFAULT_ZONE_PRICING.per_mile),
          minimum_fare: Number(row.avg_minimum_fare ?? DEFAULT_ZONE_PRICING.minimum_fare),
          wheelchair_addon: Number(row.avg_wheelchair_addon ?? DEFAULT_ZONE_PRICING.wheelchair_addon),
          stretcher_addon: Number(row.avg_stretcher_addon ?? DEFAULT_ZONE_PRICING.stretcher_addon),
        };
        usingDefault = false;
      }
    }

    const zoneBreak = computeFareBreakdown(zoneSrc, miles, data.transportType, legs, waitMinutes, 0);

    let provider: ZonePriceEstimate["provider"] = null;
    if (data.providerId) {
      const { data: pp } = await sb
        .from("provider_pricing")
        .select("owner_id, base_pickup, per_mile, minimum_fare, wheelchair_addon, stretcher_addon, wait_per_min, wait_unit")
        .eq("owner_id", data.providerId)
        .maybeSingle();
      if (pp) {
        const p: any = pp;
        const waitUnit = String(p.wait_unit ?? "hour");
        const waitPerHour = waitUnit === "hour"
          ? Number(p.wait_per_min || 0)
          : waitUnit === "half_hour"
            ? Number(p.wait_per_min || 0) * 2
            : Number(p.wait_per_min || 0) * 60;
        const pb = computeFareBreakdown(p, miles, data.transportType, legs, waitMinutes, waitPerHour);
        provider = { id: data.providerId, dollars: pb.total, lines: pb.lines };
      }
    }

    return {
      zone,
      zoneAverage: { dollars: Math.round(zoneBreak.total * 100) / 100, usingDefault, lines: zoneBreak.lines },
      provider,
      miles,
      legs,
      waitMinutes,
      transportType: data.transportType,
    };
  });

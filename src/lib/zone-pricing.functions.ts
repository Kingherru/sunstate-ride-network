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

function computeFare(
  p: {
    base_pickup: number;
    per_mile: number;
    minimum_fare: number;
    wheelchair_addon?: number;
    stretcher_addon?: number;
  },
  miles: number,
  transport: "ambulatory" | "wheelchair" | "gurney",
): number {
  const base = Number(p.base_pickup) || 0;
  const mile = Number(p.per_mile) || 0;
  const min = Number(p.minimum_fare) || 0;
  const addon =
    transport === "wheelchair" ? Number(p.wheelchair_addon) || 0 :
    transport === "gurney" ? Number(p.stretcher_addon) || 0 : 0;
  const raw = base + mile * Math.max(0, miles) + addon;
  return Math.max(min, raw);
}

const inputSchema = z.object({
  pickupZip: z.string().trim().max(10).optional().or(z.literal("")),
  zoneId: z.string().uuid().optional().or(z.literal("")),
  miles: z.number().min(0).max(500).default(10),
  transportType: z.enum(["ambulatory", "wheelchair", "gurney"]).default("ambulatory"),
  providerId: z.string().uuid().optional().or(z.literal("")),
});

export type ZonePriceEstimate = {
  zone: { id: string | null; name: string | null; providerCount: number } | null;
  zoneAverage: { dollars: number; usingDefault: boolean };
  provider: { id: string; dollars: number } | null;
  miles: number;
  transportType: "ambulatory" | "wheelchair" | "gurney";
};

export const estimateTripPrice = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => inputSchema.parse(i))
  .handler(async ({ data }): Promise<ZonePriceEstimate> => {
    const sb = serverClient();
    const miles = data.miles || 0;

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

    const zoneDollars = computeFare(zoneSrc, miles, data.transportType);

    let provider: ZonePriceEstimate["provider"] = null;
    if (data.providerId) {
      const { data: pp } = await sb
        .from("provider_pricing")
        .select("owner_id, base_pickup, per_mile, minimum_fare, wheelchair_addon, stretcher_addon")
        .eq("owner_id", data.providerId)
        .maybeSingle();
      if (pp) {
        provider = {
          id: data.providerId,
          dollars: computeFare(pp as any, miles, data.transportType),
        };
      }
    }

    return {
      zone,
      zoneAverage: { dollars: Math.round(zoneDollars * 100) / 100, usingDefault },
      provider,
      miles,
      transportType: data.transportType,
    };
  });

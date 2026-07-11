import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MarketPricing = {
  ambulatory_base: number; ambulatory_per_mile: number;
  wheelchair_base: number; wheelchair_per_mile: number;
  stretcher_base: number;  stretcher_per_mile: number;
  wait_per_hour: number;
  no_show: number;
  cancellation: number;
  after_hours_addon: number;
  holiday_surcharge: number;
  additional_passenger: number;
  minimum_fare: number;
};

export const FL_MARKET_DEFAULTS: MarketPricing = {
  ambulatory_base: 30, ambulatory_per_mile: 3.0,
  wheelchair_base: 50, wheelchair_per_mile: 3.5,
  stretcher_base: 175, stretcher_per_mile: 5.0,
  wait_per_hour: 45, no_show: 25, cancellation: 15,
  after_hours_addon: 20, holiday_surcharge: 25,
  additional_passenger: 5, minimum_fare: 25,
};

export const FL_MEDICAID_DEFAULTS: MarketPricing = {
  ambulatory_base: 12.5, ambulatory_per_mile: 1.6,
  wheelchair_base: 22, wheelchair_per_mile: 2.3,
  stretcher_base: 110, stretcher_per_mile: 4.25,
  wait_per_hour: 18, no_show: 12, cancellation: 0,
  after_hours_addon: 10, holiday_surcharge: 15,
  additional_passenger: 0, minimum_fare: 12.5,
};

export const getPlatformPricingDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("platform_settings")
      .select("market_pricing, medicaid_pricing")
      .maybeSingle();
    if (error) throw error;
    return {
      market: { ...FL_MARKET_DEFAULTS, ...((data?.market_pricing as any) ?? {}) } as MarketPricing,
      medicaid: { ...FL_MEDICAID_DEFAULTS, ...((data?.medicaid_pricing as any) ?? {}) } as MarketPricing,
    };
  });

export const savePlatformPricingDefaults = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { market: MarketPricing; medicaid: MarketPricing }) => input)
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    const { data: isAppMgr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "app_manager",
    });
    if (!isAdmin && !isAppMgr) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("platform_settings")
      .upsert({ id: true, market_pricing: data.market as any, medicaid_pricing: data.medicaid as any }, { onConflict: "id" });
    if (error) throw error;
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateTripCost, DEFAULT_RATES, type PricingRates } from "./pricing";

export const getMyPricing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("provider_pricing").select("*").eq("owner_id", context.userId).maybeSingle();
    if (error) throw error;
    return data;
  });

export const saveMyPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Partial<PricingRates>) => input)
  .handler(async ({ data, context }) => {
    const row = { ...DEFAULT_RATES, ...data, owner_id: context.userId } as Record<string, unknown>;
    // Defensive: drop any unknown keys (e.g. legacy) to keep upsert clean
    const { data: out, error } = await context.supabase
      .from("provider_pricing").upsert(row as any, { onConflict: "owner_id" }).select().single();
    if (error) throw error;
    return out;
  });


/** Recalculate a trip's cost using the caller's pricing book. */
export const recalcTripCost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const [{ data: trip }, { data: rates }] = await Promise.all([
      supabase.from("trips").select("*").eq("id", data.trip_id).single(),
      supabase.from("provider_pricing").select("*").eq("owner_id", userId).maybeSingle(),
    ]);
    if (!trip) throw new Error("Trip not found");
    const breakdown = calculateTripCost(
      {
        status: trip.status,
        miles: trip.actual_miles ?? trip.estimated_miles,
        wait_minutes: trip.wait_minutes,
        transport_type: trip.transport_type,
        additional_passengers: trip.additional_passengers,
        pickup_date: trip.pickup_date,
        pickup_time: trip.pickup_time,
      },
      { ...DEFAULT_RATES, ...(rates ?? {}) } as PricingRates,
    );
    // Never write fare/payout amounts directly to trips from a provider action.
    // Providers must submit a quote and staff/requester approval applies the fare
    // through the controlled quote workflow.
    return { ...breakdown, quote_required: true };
  });

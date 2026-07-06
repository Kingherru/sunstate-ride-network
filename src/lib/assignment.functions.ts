import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const suggestProvidersForTrip = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("suggest_providers_for_trip", {
      _trip_id: data.trip_id,
    });
    if (error) throw error;
    return rows ?? [];
  });

export const offerTripPriority = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; provider_user_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("offer_trip_priority", {
      _trip_id: data.trip_id,
      _provider_user_id: data.provider_user_id,
    });
    if (error) throw error;
    return { ok: true };
  });

export const respondPriorityOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; accept: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("respond_priority_offer", {
      _trip_id: data.trip_id,
      _accept: data.accept,
    });
    if (error) throw error;
    return { ok: true };
  });

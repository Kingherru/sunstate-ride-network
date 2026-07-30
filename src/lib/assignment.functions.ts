import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignmentBlockReason, isTripPaid, WAITING_ON_PAYMENT_LABEL, WAITING_ON_PAYMENT_NOTE } from "@/lib/payment-gate";


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
    // Payment gate: a trip cannot be offered/sent to a provider before payment.
    const { data: trip } = await context.supabase
      .from("trips")
      .select("payment_status, fin_payment_state")
      .eq("id", data.trip_id)
      .maybeSingle();
    const blocked = assignmentBlockReason(trip as any);
    if (blocked) throw new Error(blocked);

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

/**
 * Ops staff: run the auto-dispatch engine on an existing unassigned trip.
 * Auto-routing is allowed before payment, but the receiving provider is
 * explicitly notified not to perform the trip until payment is received.
 */
export const autoAssignTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: picked, error } = await context.supabase.rpc("auto_assign_trip", {
      _trip_id: data.trip_id,
    });
    if (error) throw error;
    const assigned = (picked as string | null) ?? null;

    let waiting_on_payment = false;
    if (assigned) {
      const { data: trip } = await context.supabase
        .from("trips")
        .select("display_id, payment_status, fin_payment_state")
        .eq("id", data.trip_id)
        .maybeSingle();
      waiting_on_payment = !isTripPaid(trip as any);
      if (waiting_on_payment) {
        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("notifications").insert({
            user_id: assigned,
            type: "trip_waiting_on_payment",
            title: `${WAITING_ON_PAYMENT_LABEL} — trip ${(trip as any)?.display_id ?? ""}`.trim(),
            body: WAITING_ON_PAYMENT_NOTE,
            link: `/dashboard?trip=${data.trip_id}`,
          });
        } catch { /* non-fatal */ }
      }
    }

    return { assigned_to: assigned, waiting_on_payment };
  });


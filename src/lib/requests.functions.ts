import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ride_requests")
      .select(
        "id, status, created_at, canceled_at, cancel_reason, pickup_address, pickup_city, pickup_date, pickup_time, dropoff_address, dropoff_city, transport_type, round_trip, recurrence_rule, patient_first_name, patient_last_name, patient_phone, mobility_notes, special_instructions"
      )
      .eq("requester_user_id", userId)
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false });
    if (error) {
      console.error("listMyRequests error", error);
      return { ok: false as const, error: "Could not load your ride requests." };
    }
    return { ok: true as const, rows: data ?? [] };
  });

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("ride_requests")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: data.reason || null,
      })
      .eq("id", data.id)
      .eq("requester_user_id", userId);
    if (error) {
      console.error("cancelMyRequest error", error);
      return { ok: false as const, error: "Could not cancel that request." };
    }
    return { ok: true as const };
  });

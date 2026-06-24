import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SELECT_COLS =
  "id, status, created_at, last_updated_at, canceled_at, cancel_reason, pickup_address, pickup_city, pickup_date, pickup_time, dropoff_address, dropoff_city, transport_type, round_trip, recurrence_rule, recurrence_exceptions, recurrence_end_date, patient_first_name, patient_last_name, patient_phone, patient_email, mobility_notes, special_instructions, provider_notes, payment_status, payment_amount_cents, assigned_provider_id, requester_user_id";

export const listMyRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("ride_requests")
      .select(SELECT_COLS)
      .eq("requester_user_id", userId)
      .order("pickup_date", { ascending: false })
      .order("pickup_time", { ascending: false });
    if (error) {
      console.error("listMyRequests error", error);
      return { ok: false as const, error: "Could not load your ride requests." };
    }
    return { ok: true as const, rows: data ?? [] };
  });

export const getMyRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("ride_requests")
      .select(SELECT_COLS)
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (error) {
      console.error("getMyRequest error", error);
      return { ok: false as const, error: "Could not load that request." };
    }
    if (!row) return { ok: false as const, error: "Request not found." };
    return { ok: true as const, row };
  });

const cancelSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
  /** For recurring: 'next' skips the next occurrence; 'all_future' ends the series today; 'single' cancels a one-off request. */
  scope: z.enum(["single", "next", "all_future"]).default("single"),
});

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => cancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Fetch row first so we can validate scope + compute updates
    const { data: row, error: readErr } = await supabase
      .from("ride_requests")
      .select(
        "id, status, recurrence_rule, recurrence_exceptions, recurrence_end_date, pickup_date, requester_user_id"
      )
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (readErr || !row) {
      return { ok: false as const, error: "Request not found." };
    }

    const todayIso = new Date().toISOString().slice(0, 10);

    if (data.scope === "next" && row.recurrence_rule) {
      const exceptions = Array.isArray(row.recurrence_exceptions) ? row.recurrence_exceptions : [];
      if (!exceptions.includes(row.pickup_date)) exceptions.push(row.pickup_date);
      const { error } = await supabase
        .from("ride_requests")
        .update({ recurrence_exceptions: exceptions })
        .eq("id", data.id)
        .eq("requester_user_id", userId);
      if (error) return { ok: false as const, error: "Could not skip the next occurrence." };
      return { ok: true as const, scope: "next" as const };
    }

    if (data.scope === "all_future" && row.recurrence_rule) {
      const { error } = await supabase
        .from("ride_requests")
        .update({
          recurrence_end_date: todayIso,
          status: "canceled",
          canceled_at: new Date().toISOString(),
          cancel_reason: data.reason || null,
        })
        .eq("id", data.id)
        .eq("requester_user_id", userId);
      if (error) return { ok: false as const, error: "Could not end the recurring series." };
      return { ok: true as const, scope: "all_future" as const };
    }

    // single (default) — full cancel
    const { error } = await supabase
      .from("ride_requests")
      .update({
        status: "canceled",
        canceled_at: new Date().toISOString(),
        cancel_reason: data.reason || null,
      })
      .eq("id", data.id)
      .eq("requester_user_id", userId);
    if (error) return { ok: false as const, error: "Could not cancel that request." };
    return { ok: true as const, scope: "single" as const };
  });

const rescheduleSchema = z.object({
  id: z.string().uuid(),
  pickupDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pickupTime: z.string().regex(/^\d{2}:\d{2}$/),
  pickupAddress: z.string().trim().min(3).max(300),
  pickupCity: z.string().trim().min(1).max(100),
  specialInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
});

export const rescheduleMyRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rescheduleSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Block reschedule on completed/canceled
    const { data: row } = await supabase
      .from("ride_requests")
      .select("status")
      .eq("id", data.id)
      .eq("requester_user_id", userId)
      .maybeSingle();
    if (!row) return { ok: false as const, error: "Request not found." };
    const s = (row.status ?? "").toLowerCase();
    if (["completed", "canceled", "cancelled", "in_progress"].includes(s)) {
      return { ok: false as const, error: `This request can no longer be rescheduled (${row.status}).` };
    }

    const { error } = await supabase
      .from("ride_requests")
      .update({
        pickup_date: data.pickupDate,
        pickup_time: data.pickupTime,
        pickup_address: data.pickupAddress,
        pickup_city: data.pickupCity,
        special_instructions: data.specialInstructions || null,
      })
      .eq("id", data.id)
      .eq("requester_user_id", userId);
    if (error) {
      console.error("rescheduleMyRequest error", error);
      return { ok: false as const, error: "Could not update that request." };
    }
    return { ok: true as const };
  });

// ---------- Notifications ----------

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, ride_request_id, read_at, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { ok: false as const, error: "Could not load notifications." };
    return { ok: true as const, rows: data ?? [] };
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid().optional(), all: z.boolean().optional() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const q = supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("read_at", null);
    const { error } = data.all ? await q : await q.eq("id", data.id ?? "");
    if (error) return { ok: false as const, error: "Could not mark notifications read." };
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Provider accepts a trip. */
export const acceptTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("accept_trip", { _trip_id: data.trip_id });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Provider declines a trip. */
export const declineTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decline_trip", {
      _trip_id: data.trip_id,
      _reason: data.reason ?? undefined,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Provider submits a manual quote for a trip. */
export const submitTripQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      trip_id: z.string().uuid(),
      amount_cents: z.number().int().positive().max(10_000_00),
      note: z.string().trim().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: quoteId, error } = await context.supabase.rpc("submit_trip_quote", {
      _trip_id: data.trip_id,
      _amount_cents: data.amount_cents,
      _note: data.note ?? undefined,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, quote_id: quoteId as string };
  });

/** Ops staff approves or rejects a quote. */
export const decideTripQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      quote_id: z.string().uuid(),
      approve: z.boolean(),
      note: z.string().trim().max(500).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decide_trip_quote", {
      _quote_id: data.quote_id,
      _approve: data.approve,
      _note: data.note ?? undefined,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** List quotes for a trip (visible per RLS: provider sees own, staff sees all, requester sees approved). */
export const listTripQuotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("trip_quotes")
      .select("id, trip_id, provider_user_id, amount_cents, note, status, decided_by, decided_at, decision_note, created_at")
      .eq("trip_id", data.trip_id)
      .order("created_at", { ascending: false });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, quotes: rows ?? [] };
  });

/** Open (or reuse) a direct thread with an ops staff admin. */
export const startStaffThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { initial_body?: string } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const { data: threadId, error } = await context.supabase.rpc("start_staff_thread");
    if (error) return { ok: false as const, error: error.message };
    const body = (data?.initial_body ?? "").trim();
    if (body && threadId) {
      await context.supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: context.userId,
        body,
      });
    }
    return { ok: true as const, thread_id: threadId as string };
  });

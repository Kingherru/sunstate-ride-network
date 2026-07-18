import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * NEW FINANCE SYSTEM
 * -------------------
 * All money mutations go through these server functions. They wrap the
 * `fin_*` RPCs defined in the database. The RPCs enforce authorization and
 * post-lock rules; these wrappers just add auth middleware + typed input.
 */

// -----------------------------------------------------------
// Public read: platform settings (fee bps + hold windows)
// -----------------------------------------------------------
export const getFinSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("fin_get_settings");
  if (error) return { platform_fee_bps: 200, standard_hold_hours: 48, medicaid_hold_days: 15 };
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? { platform_fee_bps: 200, standard_hold_hours: 48, medicaid_hold_days: 15 };
});

// -----------------------------------------------------------
// Admin ledger listing
// -----------------------------------------------------------
export const listFinLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("admin_fin_ledger")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// -----------------------------------------------------------
// Admin: set gross + fee snapshot for a trip
// -----------------------------------------------------------
export const setTripAmounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    trip_id: string;
    gross_cents: number;
    referral_flat_cents?: number;
    payer_kind?: "patient" | "facility" | "broker" | "workers_comp" | "medicaid" | "provider_self";
    payer_user_id?: string;
    payment_source?: string;
    is_medicaid?: boolean;
  }) =>
    z.object({
      trip_id: z.string().uuid(),
      gross_cents: z.number().int().min(0).max(1_000_000),
      referral_flat_cents: z.number().int().min(0).optional(),
      payer_kind: z.enum([
        "patient","facility","broker","workers_comp","medicaid","provider_self",
      ]).optional(),
      payer_user_id: z.string().uuid().optional(),
      payment_source: z.string().max(64).optional(),
      is_medicaid: z.boolean().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("fin_set_amounts", {
      _trip_id: data.trip_id,
      _gross_cents: data.gross_cents,
      _referral_flat_cents: data.referral_flat_cents ?? 0,
      _payer_kind: data.payer_kind ?? null,
      _payer_user_id: data.payer_user_id ?? null,
      _payment_source: data.payment_source ?? null,
      _is_medicaid: data.is_medicaid ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------
// Admin/ops: validate payment (starts hold clock)
// -----------------------------------------------------------
export const validateTripPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string }) => z.object({ trip_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_validate_payment", { _trip_id: data.trip_id } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -----------------------------------------------------------
// Admin: release payout (bypasses only the auth gate — hold clock still enforced by DB)
// -----------------------------------------------------------
export const releaseTripPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string; transfer_ref?: string }) =>
    z.object({ trip_id: z.string().uuid(), transfer_ref: z.string().max(128).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: payoutId, error } = await supabaseAdmin.rpc("fin_release_payout", {
      _trip_id: data.trip_id,
      _transfer_ref: data.transfer_ref ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { payout_id: payoutId };
  });

// -----------------------------------------------------------
// Admin: refund a trip's charges + cancel any pending payout
// -----------------------------------------------------------
export const refundTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string; reason?: string }) =>
    z.object({ trip_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId, _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("fin_refund", {
      _trip_id: data.trip_id, _reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

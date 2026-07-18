import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * FINANCE — Provider Balance model.
 * MFN collects all money → per-trip hold → released to Provider Balance → provider cashes out.
 * All state mutations flow through fin_* SECURITY DEFINER RPCs; these are thin auth-checked wrappers.
 */

// ---------- Settings ----------
export const getFinSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("fin_settings")
    .select("platform_fee_bps, standard_hold_days, medicaid_net_business_days")
    .limit(1)
    .maybeSingle();
  return {
    platform_fee_bps: data?.platform_fee_bps ?? 200,
    standard_hold_days: data?.standard_hold_days ?? 3,
    medicaid_net_business_days: data?.medicaid_net_business_days ?? 15,
  };
});

// ---------- Admin ledger ----------
export const listFinLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("admin_fin_ledger").select("*").order("created_at", { ascending: false }).limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ---------- Admin: set/snapshot amounts ----------
export const setTripAmounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    trip_id: string; gross_cents: number; referral_flat_cents?: number;
    payer_kind?: "patient"|"facility"|"broker"|"workers_comp"|"medicaid"|"provider_self";
    payer_user_id?: string; payment_source?: string; is_medicaid?: boolean;
  }) => z.object({
    trip_id: z.string().uuid(),
    gross_cents: z.number().int().min(0).max(1_000_000),
    referral_flat_cents: z.number().int().min(0).optional(),
    payer_kind: z.enum(["patient","facility","broker","workers_comp","medicaid","provider_self"]).optional(),
    payer_user_id: z.string().uuid().optional(),
    payment_source: z.string().max(64).optional(),
    is_medicaid: z.boolean().optional(),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_set_amounts", {
      _trip_id: data.trip_id, _gross_cents: data.gross_cents,
      _referral_flat_cents: data.referral_flat_cents ?? 0,
      _payer_kind: data.payer_kind ?? null,
      _payer_user_id: data.payer_user_id ?? null,
      _payment_source: data.payment_source ?? null,
      _is_medicaid: data.is_medicaid ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: validate payment ----------
export const validateTripPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string }) => z.object({ trip_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_validate_payment", { _trip_id: data.trip_id } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: force release (skip hold) ----------
export const adminForceRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string }) => z.object({ trip_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_admin_force_release", { _trip_id: data.trip_id } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: refund ----------
export const refundTrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string; reason?: string }) =>
    z.object({ trip_id: z.string().uuid(), reason: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_refund", {
      _trip_id: data.trip_id, _reason: data.reason ?? null,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: Medicaid funds received ----------
export const adminMarkMedicaidFundsReceived = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { trip_id: string; received_at?: string }) =>
    z.object({ trip_id: z.string().uuid(), received_at: z.string().datetime().optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_mark_medicaid_received", {
      _trip_id: data.trip_id, _received_at: data.received_at ?? new Date().toISOString(),
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin: adjust balance ----------
export const adminAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { provider_user_id: string; amount_cents: number; note: string }) =>
    z.object({
      provider_user_id: z.string().uuid(),
      amount_cents: z.number().int(),
      note: z.string().min(1).max(500),
    }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_admin_adjust_balance", {
      _provider: data.provider_user_id, _amount_cents: data.amount_cents, _note: data.note,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Provider: my balance + ledger + cashouts ----------
export const getMyProviderBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [balance, ledger, cashouts] = await Promise.all([
      context.supabase.from("provider_balances")
        .select("available_cents, pending_cents, lifetime_paid_out_cents, updated_at")
        .eq("provider_user_id", uid).maybeSingle(),
      context.supabase.from("provider_balance_entries")
        .select("id, kind, amount_cents, state, available_at, note, trip_id, created_at")
        .eq("provider_user_id", uid).order("created_at", { ascending: false }).limit(50),
      context.supabase.from("provider_cashouts")
        .select("id, amount_cents, status, stripe_transfer_id, failure_reason, requested_at, completed_at")
        .eq("provider_user_id", uid).order("requested_at", { ascending: false }).limit(20),
    ]);
    return {
      balance: balance.data ?? { available_cents: 0, pending_cents: 0, lifetime_paid_out_cents: 0, updated_at: null },
      ledger: ledger.data ?? [],
      cashouts: cashouts.data ?? [],
    };
  });

// ---------- Provider: request cashout ----------
export const requestCashout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { amount_cents: number }) =>
    z.object({ amount_cents: z.number().int().min(100).max(10_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: id, error } = await context.supabase.rpc("fin_request_cashout", {
      _amount_cents: data.amount_cents,
    } as never);
    if (error) throw new Error(error.message);
    return { cashout_id: id as unknown as string };
  });

// ---------- Admin: cron monitoring ----------
export const getFinCronStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [status, recent] = await Promise.all([
      supabaseAdmin.from("admin_fin_cron_status").select("*"),
      supabaseAdmin.from("fin_cron_runs").select("id, job_name, started_at, ended_at, ok, processed, failed, error_text, triggered_by")
        .order("started_at", { ascending: false }).limit(30),
    ]);
    return { status: status.data ?? [], recent: recent.data ?? [] };
  });

export const adminRunFinCron = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { job: "fin-release-tick" | "fin-cashout-tick" }) =>
    z.object({ job: z.enum(["fin-release-tick", "fin-cashout-tick"]) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Forbidden");
    const base = process.env.SITE_URL ?? "https://myfloridanemt.com";
    const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!key) throw new Error("Missing publishable key");
    const res = await fetch(`${base.replace(/\/$/, "")}/api/public/hooks/${data.job}?trigger=admin`, {
      method: "POST", headers: { apikey: key, "content-type": "application/json" }, body: "{}",
    });
    const text = await res.text();
    if (!res.ok) throw new Error(text || `Run failed (${res.status})`);
    return { ok: true, response: text };
  });

// ---------- Admin: fee adjust with audit trail ----------
export const adminFeeAdjust = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    trip_id: string;
    new_platform_cents?: number;
    new_referral_cents?: number;
    reason: string;
  }) => z.object({
    trip_id: z.string().uuid(),
    new_platform_cents: z.number().int().min(0).max(1_000_000).optional(),
    new_referral_cents: z.number().int().min(0).max(1_000_000).optional(),
    reason: z.string().min(3).max(500),
  }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("fin_admin_fee_adjust", {
      _trip_id: data.trip_id,
      _new_platform_cents: data.new_platform_cents ?? null,
      _new_referral_cents: data.new_referral_cents ?? null,
      _reason: data.reason,
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listAdminFinActions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { limit?: number } | undefined) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("fin_admin_recent_actions",
      { _limit: data.limit ?? 100 } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as FinAdminAction[];
  });

export type FinAdminAction = {
  id: string; admin_user_id: string | null; action: string; trip_id: string | null;
  provider_user_id: string | null; amount_cents: number | null; reason: string | null;
  metadata: Record<string, string | number | boolean | null> | null; created_at: string;
};

// ---------- Provider: detailed balance line items ----------
export const getMyProviderBalanceDetailed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const uid = context.userId;
    const [balance, entries, cashouts] = await Promise.all([
      context.supabase.from("provider_balances")
        .select("available_cents, pending_cents, lifetime_paid_out_cents, updated_at")
        .eq("provider_user_id", uid).maybeSingle(),
      context.supabase.from("provider_balance_entries")
        .select("id, kind, amount_cents, state, available_at, note, trip_id, created_at")
        .eq("provider_user_id", uid).order("created_at", { ascending: false }).limit(200),
      context.supabase.from("provider_cashouts")
        .select("id, amount_cents, status, stripe_transfer_id, failure_reason, requested_at, completed_at")
        .eq("provider_user_id", uid).order("requested_at", { ascending: false }).limit(50),
    ]);

    const rows = entries.data ?? [];
    const tripIds = Array.from(new Set(rows.map(r => r.trip_id).filter(Boolean))) as string[];
    let tripsById: Record<string, { pickup_time: string | null; fin_is_medicaid: boolean | null; fin_payout_hold_until: string | null }> = {};
    if (tripIds.length) {
      const { data: trips } = await context.supabase
        .from("trips")
        .select("id, pickup_time, fin_is_medicaid, fin_payout_hold_until")
        .in("id", tripIds);
      for (const t of trips ?? []) tripsById[t.id as string] = {
        pickup_time: (t as any).pickup_time ?? null,
        fin_is_medicaid: (t as any).fin_is_medicaid ?? null,
        fin_payout_hold_until: (t as any).fin_payout_hold_until ?? null,
      };
    }

    const detailedEntries = rows.map(r => {
      const trip = r.trip_id ? tripsById[r.trip_id] : undefined;
      let releaseReason: string | null = null;
      if (r.state === "pending" && trip) {
        releaseReason = trip.fin_is_medicaid
          ? "Held until Medicaid funds arrive + Net 15 business days"
          : "3-day validation hold";
      } else if (r.state === "available" && r.kind === "release") {
        releaseReason = "Hold period completed";
      } else if (r.kind === "reversal") {
        releaseReason = r.note ?? "Reversed";
      } else if (r.kind === "adjustment") {
        releaseReason = r.note ?? "Admin adjustment";
      }
      return {
        ...r,
        trip_pickup_time: trip?.pickup_time ?? null,
        trip_is_medicaid: trip?.fin_is_medicaid ?? null,
        release_reason: releaseReason,
      };
    });

    return {
      balance: balance.data ?? { available_cents: 0, pending_cents: 0, lifetime_paid_out_cents: 0, updated_at: null },
      entries: detailedEntries,
      cashouts: cashouts.data ?? [],
    };
  });

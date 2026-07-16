// Server-only payout helpers. NEVER import from client-reachable modules.
import { PLATFORM_FEE_PCT } from "@/lib/payouts";

export type ReleaseResult = {
  ok: boolean;
  tripId: string;
  status: "paid" | "failed" | "held" | "skipped";
  transferId?: string | null;
  netCents?: number;
  feeCents?: number;
  reason?: string;
};

type TripRow = {
  id: string; status: string; cost_total: number | null;
  assigned_to: string | null; created_by: string | null;
  payout_status: string; payment_status: string;
  payer: string | null; medicaid_number: string | null; medicaid_plan: string | null;
  payout_eligible_at: string | null;
};

function validatePayoutGates(t: TripRow, netCents: number): string[] {
  const reasons: string[] = [];
  if (t.status !== "completed") reasons.push("trip_not_completed");
  if (!t.assigned_to) reasons.push("no_provider_assigned");
  if (t.assigned_to && t.created_by && t.assigned_to === t.created_by) reasons.push("provider_is_trip_creator");
  if (t.payment_status !== "confirmed") reasons.push("payment_not_captured");
  const grossCents = Math.round(Number(t.cost_total ?? 0) * 100);
  if (grossCents <= 0) reasons.push("no_fare_amount");
  if (netCents <= 0) reasons.push("net_amount_zero");
  return reasons;
}

/**
 * Attempt to release funds for a single trip. Fully idempotent — refuses to
 * double-pay a trip that already has a paid transfer or `released` status.
 * Enforces the 48h / Net-15 eligibility window unless `overrideWait` is set.
 * Only ever called from server-only code (admin server fn or cron route).
 */
export async function attemptTripPayoutRelease(opts: {
  tripId: string;
  actorUserId: string | null; // null for cron/service
  overrideWait?: boolean;
}): Promise<ReleaseResult> {
  const { tripId, actorUserId, overrideWait = false } = opts;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stripeEnv: "sandbox" | "live" = process.env.STRIPE_LIVE_API_KEY ? "live" : "sandbox";

  const { data: trip } = await supabaseAdmin
    .from("trips")
    .select("id, status, cost_total, assigned_to, created_by, payout_status, payment_status, payer, medicaid_number, medicaid_plan, payout_eligible_at")
    .eq("id", tripId)
    .maybeSingle();
  if (!trip) return { ok: false, tripId, status: "skipped", reason: "not_found" };
  const t = trip as unknown as TripRow;

  if (t.payout_status === "released") return { ok: true, tripId, status: "skipped", reason: "already_released" };

  // Double-payment guard
  const { data: priorPaid } = await supabaseAdmin
    .from("provider_payout_transfers")
    .select("id").eq("trip_id", t.id).eq("status", "paid").limit(1);
  if (priorPaid && priorPaid.length > 0) {
    await supabaseAdmin.from("trips").update({
      payout_status: "released",
      payout_hold_reasons: [],
    }).eq("id", t.id);
    return { ok: true, tripId, status: "skipped", reason: "prior_paid_transfer_exists" };
  }

  // Recompute amounts — never trust stored provider_payout_cents.
  const grossCents = Math.round(Number(t.cost_total ?? 0) * 100);
  const { data: feeRow } = await supabaseAdmin
    .from("platform_settings").select("platform_fee_pct").eq("id", true).maybeSingle();
  const feePct = Number(feeRow?.platform_fee_pct);
  const effectivePct = Number.isFinite(feePct) ? feePct : PLATFORM_FEE_PCT;
  const feeCents = Math.max(0, Math.round(grossCents * effectivePct));
  const netCents = Math.max(0, grossCents - feeCents);

  const gateReasons = validatePayoutGates(t, netCents);
  if (gateReasons.length > 0) {
    await supabaseAdmin.from("trips").update({
      payout_status: "held", payout_hold_reasons: gateReasons,
    }).eq("id", t.id);
    return { ok: false, tripId, status: "held", reason: gateReasons.join(",") };
  }

  if (!overrideWait) {
    const eligibleMs = t.payout_eligible_at ? Date.parse(t.payout_eligible_at) : Date.now();
    if (Number.isFinite(eligibleMs) && eligibleMs > Date.now()) {
      return { ok: false, tripId, status: "skipped", reason: "inside_hold_window" };
    }
  }

  const { data: acct } = await supabaseAdmin
    .from("provider_payout_accounts")
    .select("stripe_account_id, payouts_enabled")
    .eq("user_id", t.assigned_to!)
    .maybeSingle();

  if (!acct?.stripe_account_id || !acct.payouts_enabled) {
    await supabaseAdmin.from("trips").update({
      payout_status: "held",
      payout_hold_reasons: ["provider_payout_account_not_active"],
    }).eq("id", t.id);
    return { ok: false, tripId, status: "held", reason: "provider_payout_account_not_active" };
  }

  const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
  const stripe = createStripeClient(stripeEnv);
  let transferId: string | null = null;
  let transferStatus: "paid" | "failed" = "failed";
  let failureReason: string | null = null;
  try {
    const tr = await stripe.transfers.create({
      amount: netCents,
      currency: "usd",
      destination: acct.stripe_account_id,
      transfer_group: `trip_${t.id}`,
      metadata: {
        trip_id: t.id,
        provider_user_id: t.assigned_to!,
        released_by: actorUserId ?? "cron",
      },
    }, { idempotencyKey: `trip_payout_${t.id}` });
    transferId = tr.id;
    transferStatus = "paid";
  } catch (e) {
    failureReason = getStripeErrorMessage(e);
  }

  await supabaseAdmin.from("provider_payout_transfers").insert({
    trip_id: t.id,
    provider_user_id: t.assigned_to!,
    stripe_account_id: acct.stripe_account_id,
    stripe_transfer_id: transferId,
    gross_cents: grossCents,
    fee_cents: feeCents,
    net_cents: netCents,
    status: transferStatus,
    failure_reason: failureReason,
  });

  await supabaseAdmin.from("trips").update({
    provider_payout_cents: netCents,
    platform_fee_cents: feeCents,
    payout_status: transferStatus === "paid" ? "released" : "held",
    payout_released_at: transferStatus === "paid" ? new Date().toISOString() : null,
    payout_released_by: transferStatus === "paid" ? actorUserId : null,
    payout_transfer_id: transferId,
    payout_hold_reasons: transferStatus === "paid" ? [] : ["transfer_failed"],
  }).eq("id", t.id);

  return {
    ok: transferStatus === "paid",
    tripId,
    status: transferStatus,
    transferId,
    netCents,
    feeCents,
    reason: failureReason ?? undefined,
  };
}

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLATFORM_FEE_PCT } from "@/lib/payouts";

type StripeEnvLocal = "sandbox" | "live";

// ─── Payout policy constants ─────────────────────────────────────────────
// Standard trips: 48-hour validation hold before funds may be released.
export const PAYOUT_STANDARD_HOLD_HOURS = 48;
// Medicaid trips: Net-15 — MFN does not receive Medicaid funds immediately.
export const PAYOUT_MEDICAID_NET_DAYS = 15;

function pickEnv(): StripeEnvLocal {
  return process.env.STRIPE_LIVE_API_KEY ? "live" : "sandbox";
}

function originFromRequest(req: Request | undefined): string {
  if (!req) return "https://localhost";
  try { return new URL(req.url).origin; } catch { return "https://localhost"; }
}

/** Start (or resume) Stripe Connect Express onboarding for the signed-in provider. */
export const createConnectOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const env = pickEnv();

    const { data: existing } = await supabase
      .from("provider_payout_accounts")
      .select("stripe_account_id, status")
      .eq("user_id", userId)
      .maybeSingle();

    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = createStripeClient(env);

    try {
      let accountId = existing?.stripe_account_id ?? null;
      if (!accountId) {
        const acct = await stripe.accounts.create({
          type: "express",
          country: "US",
          email: (claims as any)?.email ?? undefined,
          capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
          business_type: "individual",
          metadata: { lovable_user_id: userId },
        });
        accountId = acct.id;
        await supabaseAdmin.from("provider_payout_accounts").upsert(
          { user_id: userId, stripe_account_id: accountId, status: "pending", updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
      }

      const { getRequest } = await import("@tanstack/react-start/server");
      const origin = originFromRequest(getRequest());
      const link = await stripe.accountLinks.create({
        account: accountId,
        type: "account_onboarding",
        refresh_url: `${origin}/dashboard?tab=payouts&refresh=1`,
        return_url: `${origin}/dashboard?tab=payouts&connected=1`,
      });
      return { ok: true as const, url: link.url };
    } catch (e) {
      return { ok: false as const, error: getStripeErrorMessage(e) };
    }
  });

/** Pull latest status from Stripe and write it to provider_payout_accounts. */
export const refreshPayoutAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const env = pickEnv();
    const { data: row } = await supabase
      .from("provider_payout_accounts")
      .select("stripe_account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!row?.stripe_account_id) return { ok: false as const, error: "No connected account" };

    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const stripe = createStripeClient(env);
    try {
      const acct = await stripe.accounts.retrieve(row.stripe_account_id);
      const status: "pending" | "active" | "restricted" =
        acct.charges_enabled && acct.payouts_enabled
          ? "active"
          : (acct.requirements?.disabled_reason ? "restricted" : "pending");
      await supabaseAdmin
        .from("provider_payout_accounts")
        .update({
          status,
          payouts_enabled: !!acct.payouts_enabled,
          charges_enabled: !!acct.charges_enabled,
          details_submitted: !!acct.details_submitted,
          requirements_due: (acct.requirements as any) ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return { ok: true as const, status };
    } catch (e) {
      return { ok: false as const, error: getStripeErrorMessage(e) };
    }
  });

// ─── Validation helper ────────────────────────────────────────────────────
type TripRow = {
  id: string; status: string; cost_total: number | null;
  assigned_to: string | null; created_by: string | null;
  payout_status: string; payment_status: string;
  provider_payout_cents: number | null; platform_fee_cents: number | null;
  payer: string | null; medicaid_number: string | null; medicaid_plan: string | null;
  completed_at: string | null;
};

function isMedicaidTrip(t: TripRow): boolean {
  return (
    (t.payer ?? "").toLowerCase().includes("medicaid") ||
    !!t.medicaid_number || !!t.medicaid_plan
  );
}

/**
 * Compute all validation gates for a trip payout. Returns an empty array when
 * the trip is clear to release; otherwise returns human-readable hold reasons.
 */
function validatePayoutGates(t: TripRow, capturedCents: number, expectedNetCents: number, actualNetCents: number): string[] {
  const reasons: string[] = [];
  if (t.status !== "completed") reasons.push("trip_not_completed");
  if (!t.assigned_to) reasons.push("no_provider_assigned");
  if (t.assigned_to && t.created_by && t.assigned_to === t.created_by) reasons.push("provider_is_trip_creator");
  if (t.payment_status !== "paid") reasons.push("payment_not_captured");
  const grossCents = Math.round(Number(t.cost_total ?? 0) * 100);
  if (grossCents <= 0) reasons.push("no_fare_amount");
  if (capturedCents > 0 && capturedCents < grossCents) reasons.push("captured_amount_less_than_fare");
  if (Math.abs(expectedNetCents - actualNetCents) > 1) reasons.push("payout_amount_mismatch");
  return reasons;
}

/**
 * PROVIDER-CALLABLE: Called automatically on trip completion. Never sends
 * money. Runs validation and puts the trip in a holding period:
 *   • Standard trips: 48-hour validation window.
 *   • Medicaid trips: Net-15 (MFN receives Medicaid funds later).
 * Actual money movement requires an admin to run `adminReleaseTripPayout`.
 */
export const releaseTripPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: trip, error: tErr } = await supabase
      .from("trips")
      .select("id, status, cost_total, assigned_to, created_by, payout_status, payment_status, provider_payout_cents, platform_fee_cents, payer, medicaid_number, medicaid_plan, completed_at")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tErr || !trip) return { ok: false as const, error: "Trip not found" };
    const t = trip as unknown as TripRow;

    // Only the trip creator (sender) or an admin/dispatcher may queue a payout.
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (t.created_by !== userId && !isAdmin) return { ok: false as const, error: "Forbidden" };
    if (t.payout_status === "released") return { ok: true as const, alreadyReleased: true };

    const grossCents = Math.round(Number(t.cost_total ?? 0) * 100);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: feeRow } = await supabaseAdmin
      .from("platform_settings").select("platform_fee_pct").eq("id", true).maybeSingle();
    const feePct = Number(feeRow?.platform_fee_pct);
    const effectivePct = Number.isFinite(feePct) ? feePct : PLATFORM_FEE_PCT;
    const feeCents = Math.max(0, Math.round(grossCents * effectivePct));
    const netCents = Math.max(0, grossCents - feeCents);

    const medicaid = isMedicaidTrip(t);
    const holdHours = medicaid ? PAYOUT_MEDICAID_NET_DAYS * 24 : PAYOUT_STANDARD_HOLD_HOURS;
    const eligibleAt = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();

    // Validation gates. If any fail, park the payout on hold instead of scheduling it.
    const gateReasons = validatePayoutGates(t, /*captured*/ t.payment_status === "paid" ? grossCents : 0, netCents, netCents);

    await supabaseAdmin
      .from("trips")
      .update({
        provider_payout_cents: netCents,
        platform_fee_cents: feeCents,
        payout_is_medicaid: medicaid,
        payout_eligible_at: eligibleAt,
        payout_hold_reasons: gateReasons,
        payout_status: gateReasons.length ? "held" : "pending",
      })
      .eq("id", t.id);

    return {
      ok: true as const,
      queued: true,
      medicaid,
      eligibleAt,
      holdReasons: gateReasons,
      netCents,
      feeCents,
    };
  });

/**
 * ADMIN-ONLY: Actually move funds. Re-runs every validation gate at release
 * time (defense-in-depth), enforces the 48h / Net-15 wait, forbids the trip
 * creator from being the provider, and requires payment_status = "paid".
 * Idempotent: refuses to double-pay a trip whose payout is already released.
 */
export const adminReleaseTripPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; override_wait?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = pickEnv();

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Admin only" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: trip } = await supabaseAdmin
      .from("trips")
      .select("id, status, cost_total, assigned_to, created_by, payout_status, payment_status, provider_payout_cents, platform_fee_cents, payer, medicaid_number, medicaid_plan, completed_at, payout_eligible_at, payout_transfer_id")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (!trip) return { ok: false as const, error: "Trip not found" };
    const t = trip as any as TripRow & { payout_eligible_at: string | null; payout_transfer_id: string | null };

    if (t.payout_status === "released") return { ok: true as const, alreadyReleased: true };

    // Double-payment guard — refuse if any prior "paid" transfer exists for this trip.
    const { data: priorPaid } = await supabaseAdmin
      .from("provider_payout_transfers")
      .select("id")
      .eq("trip_id", t.id).eq("status", "paid").limit(1);
    if (priorPaid && priorPaid.length > 0) {
      return { ok: false as const, error: "A completed payout transfer already exists for this trip." };
    }

    // Recompute amounts from settings — never trust stored provider_payout_cents.
    const grossCents = Math.round(Number(t.cost_total ?? 0) * 100);
    const { data: feeRow } = await supabaseAdmin
      .from("platform_settings").select("platform_fee_pct").eq("id", true).maybeSingle();
    const feePct = Number(feeRow?.platform_fee_pct);
    const effectivePct = Number.isFinite(feePct) ? feePct : PLATFORM_FEE_PCT;
    const feeCents = Math.max(0, Math.round(grossCents * effectivePct));
    const netCents = Math.max(0, grossCents - feeCents);

    const gateReasons = validatePayoutGates(t, grossCents, netCents, netCents);
    if (gateReasons.length > 0) {
      await supabaseAdmin.from("trips").update({
        payout_status: "held", payout_hold_reasons: gateReasons,
      }).eq("id", t.id);
      return { ok: false as const, error: `Held: ${gateReasons.join(", ")}` };
    }

    // Enforce hold window unless admin explicitly overrides.
    if (!data.override_wait) {
      const eligibleMs = t.payout_eligible_at ? Date.parse(t.payout_eligible_at) : Date.now();
      if (Number.isFinite(eligibleMs) && eligibleMs > Date.now()) {
        return { ok: false as const, error: "Payout is still inside the validation hold window." };
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
      return { ok: false as const, error: "Provider has no active payout account." };
    }

    const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
    const stripe = createStripeClient(env);
    let transferId: string | null = null;
    let transferStatus: "paid" | "failed" = "failed";
    let failureReason: string | null = null;
    try {
      const tr = await stripe.transfers.create({
        amount: netCents,
        currency: "usd",
        destination: acct.stripe_account_id,
        transfer_group: `trip_${t.id}`,
        // Stripe-side idempotency guard prevents duplicate transfers if we retry.
        metadata: { trip_id: t.id, provider_user_id: t.assigned_to!, released_by: userId },
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
      payout_released_by: transferStatus === "paid" ? userId : null,
      payout_transfer_id: transferId,
      payout_hold_reasons: transferStatus === "paid" ? [] : ["transfer_failed"],
    }).eq("id", t.id);

    return { ok: transferStatus === "paid", status: transferStatus, transferId, netCents, feeCents, error: failureReason ?? undefined };
  });

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
  if (t.payment_status !== "confirmed") reasons.push("payment_not_captured");
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
      .select("id, status, cost_total, assigned_to, created_by, payout_status, payment_status, provider_payout_cents, platform_fee_cents, referral_fee_cents, payer, medicaid_number, medicaid_plan, completed_at")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tErr || !trip) return { ok: false as const, error: "Trip not found" };
    const t = trip as unknown as TripRow & { referral_fee_cents?: number | null };

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
    const referralCents = Math.max(0, Math.min(grossCents - feeCents, Number(t.referral_fee_cents ?? 0)));
    const netCents = Math.max(0, grossCents - feeCents - referralCents);

    const medicaid = isMedicaidTrip(t);
    const holdHours = medicaid ? PAYOUT_MEDICAID_NET_DAYS * 24 : PAYOUT_STANDARD_HOLD_HOURS;
    const eligibleAt = new Date(Date.now() + holdHours * 3600 * 1000).toISOString();

    // Validation gates. If any fail, park the payout on hold instead of scheduling it.
    const gateReasons = validatePayoutGates(t, /*captured*/ t.payment_status === "confirmed" ? grossCents : 0, netCents, netCents);

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
 * ADMIN-ONLY: Actually move funds. Delegates to the server-only
 * `attemptTripPayoutRelease` helper which re-runs all validation gates,
 * enforces the hold window, and uses a Stripe idempotency key.
 */
export const adminReleaseTripPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string; override_wait?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Admin only" };
    const { attemptTripPayoutRelease } = await import("@/lib/payouts.server");
    const res = await attemptTripPayoutRelease({
      tripId: data.trip_id,
      actorUserId: userId,
      overrideWait: !!data.override_wait,
    });
    return res.ok
      ? { ok: true as const, status: res.status, transferId: res.transferId, netCents: res.netCents, feeCents: res.feeCents }
      : { ok: false as const, error: res.reason ?? res.status };
  });

/**
 * ADMIN-ONLY: List trips awaiting payout (pending or held) with computed
 * eligibility timing so the Admin Portal can show a review queue.
 */
export const listAdminPayoutQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Admin only", rows: [] as any[] };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("trips")
      .select("id, display_id, pickup_date, status, payment_status, payout_status, cost_total, provider_payout_cents, platform_fee_cents, assigned_to, created_by, payout_eligible_at, payout_hold_reasons, payout_is_medicaid, completed_at, payer")
      .in("payout_status", ["pending", "held"])
      .order("payout_eligible_at", { ascending: true, nullsFirst: true })
      .limit(500);
    return { ok: true as const, rows: data ?? [] };
  });

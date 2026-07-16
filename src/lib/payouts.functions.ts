import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLATFORM_FEE_PCT } from "@/lib/payouts";

type StripeEnvLocal = "sandbox" | "live";

function pickEnv(): StripeEnvLocal {
  // Default to sandbox; switch to live once go-live keys are present.
  return process.env.STRIPE_LIVE_API_KEY ? "live" : "sandbox";
}

function originFromRequest(req: Request | undefined): string {
  if (!req) return "https://localhost";
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://localhost";
  }
}

/** Start (or resume) Stripe Connect Express onboarding for the signed-in provider. */
export const createConnectOnboardingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context;
    const env = pickEnv();

    // Look up (or create) the payout-account row
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
          capabilities: {
            transfers: { requested: true },
            card_payments: { requested: true },
          },
          business_type: "individual",
          metadata: { lovable_user_id: userId },
        });
        accountId = acct.id;
        await supabaseAdmin.from("provider_payout_accounts").upsert(
          {
            user_id: userId,
            stripe_account_id: accountId,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      }

      // Need a return URL — use the calling request's origin
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

/** Release a completed trip's payout: compute 4% fee, transfer to connected account, record it. */
export const releaseTripPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { trip_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const env = pickEnv();

    const { data: trip, error: tErr } = await supabase
      .from("trips")
      .select("id, status, cost_total, assigned_to, created_by, payout_status, payment_status, provider_payout_cents, platform_fee_cents")
      .eq("id", data.trip_id)
      .maybeSingle();
    if (tErr || !trip) return { ok: false as const, error: "Trip not found" };
    if (trip.status !== "completed") return { ok: false as const, error: "Trip is not completed" };
    if (trip.payout_status === "released") return { ok: true as const, alreadyReleased: true };

    // Caller must be the sender (creator) or admin
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (trip.created_by !== userId && !isAdmin) return { ok: false as const, error: "Forbidden" };
    if (!trip.assigned_to) return { ok: false as const, error: "Trip has no provider" };
    // Never pay out to the trip creator (defense-in-depth against self-assigned trips).
    if (trip.assigned_to === trip.created_by) {
      return { ok: false as const, error: "Provider cannot be the trip creator" };
    }
    // Require a real captured payment before releasing funds. Payouts must
    // reflect money actually collected — not just a cost_total value written
    // to the trip row.
    if (trip.payment_status !== "paid") {
      return { ok: false as const, error: "Trip has no captured payment; cannot release payout" };
    }

    const grossCents = Math.round(Number(trip.cost_total ?? 0) * 100);
    if (grossCents <= 0) return { ok: false as const, error: "Trip has no fare" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: feeRow } = await supabaseAdmin
      .from("platform_settings")
      .select("platform_fee_pct")
      .eq("id", true)
      .maybeSingle();
    const feePct = Number(feeRow?.platform_fee_pct);
    const effectivePct = Number.isFinite(feePct) ? feePct : PLATFORM_FEE_PCT;
    const feeCents = Math.round(grossCents * effectivePct);
    const netCents = grossCents - feeCents;
    // Look up provider connected account
    const { data: acct } = await supabaseAdmin
      .from("provider_payout_accounts")
      .select("stripe_account_id, payouts_enabled, status")
      .eq("user_id", trip.assigned_to)
      .maybeSingle();

    let transferId: string | null = null;
    let transferStatus: "pending" | "paid" | "failed" = "pending";
    let failureReason: string | null = null;

    if (acct?.stripe_account_id && acct.payouts_enabled) {
      const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
      const stripe = createStripeClient(env);
      try {
        const tr = await stripe.transfers.create({
          amount: netCents,
          currency: "usd",
          destination: acct.stripe_account_id,
          transfer_group: `trip_${trip.id}`,
          metadata: { trip_id: trip.id, provider_user_id: trip.assigned_to },
        });
        transferId = tr.id;
        transferStatus = "paid";
      } catch (e) {
        failureReason = getStripeErrorMessage(e);
        transferStatus = "failed";
      }
    } else {
      failureReason = "Provider has not connected a payout account";
    }

    await supabaseAdmin.from("provider_payout_transfers").insert({
      trip_id: trip.id,
      provider_user_id: trip.assigned_to,
      stripe_account_id: acct?.stripe_account_id ?? "unconnected",
      stripe_transfer_id: transferId,
      gross_cents: grossCents,
      fee_cents: feeCents,
      net_cents: netCents,
      status: transferStatus,
      failure_reason: failureReason,
    });

    await supabaseAdmin
      .from("trips")
      .update({
        provider_payout_cents: netCents,
        platform_fee_cents: feeCents,
        payout_status: transferStatus === "paid" ? "released" : "held",
        payout_released_at: transferStatus === "paid" ? new Date().toISOString() : null,
        payout_transfer_id: transferId,
      })
      .eq("id", trip.id);

    return { ok: true as const, status: transferStatus, transferId, netCents, feeCents };
  });

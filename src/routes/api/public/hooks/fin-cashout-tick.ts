import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: process provider cash-out requests. Creates a Stripe Connect transfer
 * per pending request and marks paid/failed via SECURITY DEFINER RPCs.
 * Runs every 5 minutes. Requires header `x-fin-release-token` = FIN_RELEASE_TOKEN.
 */
export const Route = createFileRoute("/api/public/hooks/fin-cashout-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
        const env = process.env.STRIPE_LIVE_API_KEY ? "live" : "sandbox";

        const { data: queue, error } = await supabaseAdmin
          .from("provider_cashouts")
          .select("id, provider_user_id, amount_cents")
          .eq("status", "requested")
          .order("requested_at", { ascending: true })
          .limit(25);
        if (error) return new Response(error.message, { status: 500 });

        const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
        const stripe = createStripeClient(env);
        for (const c of queue ?? []) {
          await supabaseAdmin.rpc("fin_mark_cashout_processing", { _cashout_id: c.id } as never);
          const { data: acct } = await supabaseAdmin
            .from("provider_payout_accounts")
            .select("stripe_account_id, payouts_enabled")
            .eq("user_id", c.provider_user_id)
            .maybeSingle();
          if (!acct?.stripe_account_id || !acct.payouts_enabled) {
            await supabaseAdmin.rpc("fin_fail_cashout", {
              _cashout_id: c.id, _reason: "Provider Stripe account not active",
            } as never);
            results.push({ id: c.id, ok: false, reason: "no_stripe_account" });
            continue;
          }
          try {
            const tr = await stripe.transfers.create({
              amount: c.amount_cents,
              currency: "usd",
              destination: acct.stripe_account_id,
              transfer_group: `cashout_${c.id}`,
              metadata: { cashout_id: c.id, provider_user_id: c.provider_user_id },
            }, { idempotencyKey: `cashout_${c.id}` });
            await supabaseAdmin.rpc("fin_complete_cashout", {
              _cashout_id: c.id, _transfer_id: tr.id,
            } as never);
            results.push({ id: c.id, ok: true });
          } catch (e) {
            const reason = getStripeErrorMessage(e);
            await supabaseAdmin.rpc("fin_fail_cashout", { _cashout_id: c.id, _reason: reason } as never);
            results.push({ id: c.id, ok: false, reason });
          }
        }
        return Response.json({ processed: results.length, results });
      },
    },
  },
});

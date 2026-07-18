import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: process provider cash-out requests. Creates a Stripe Connect transfer
 * per pending request and marks paid/failed via SECURITY DEFINER RPCs.
 * Runs every 5 minutes. Logs each run to fin_cron_runs and emails the
 * provider on completion or failure.
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
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const triggeredBy = url.searchParams.get("trigger") ?? "cron";
        const startedAt = new Date().toISOString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { createStripeClient, getStripeErrorMessage } = await import("@/lib/stripe.server");
        const { sendFinanceEmail, formatUsd } = await import("@/lib/finance/notify.server");
        const env = process.env.STRIPE_LIVE_API_KEY ? "live" : "sandbox";

        const results: Array<{ id: string; ok: boolean; reason?: string }> = [];
        let errorText: string | null = null;

        async function notify(userId: string, template: "provider-cashout-completed" | "provider-cashout-failed",
          cashoutId: string, data: Record<string, unknown>) {
          try {
            const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
            const email = u?.user?.email;
            if (!email) return;
            await sendFinanceEmail({
              templateName: template,
              recipientEmail: email,
              idempotencyKey: `${template}-${cashoutId}`,
              origin,
              templateData: { providerName: u?.user?.user_metadata?.name ?? "there", ...data },
            });
          } catch { /* swallow */ }
        }

        try {
          const { data: queue, error } = await supabaseAdmin
            .from("provider_cashouts")
            .select("id, provider_user_id, amount_cents")
            .eq("status", "requested")
            .order("requested_at", { ascending: true })
            .limit(25);
          if (error) throw new Error(error.message);

          const stripe = createStripeClient(env);
          for (const c of queue ?? []) {
            await supabaseAdmin.rpc("fin_mark_cashout_processing", { _cashout_id: c.id } as never);
            const { data: acct } = await supabaseAdmin
              .from("provider_payout_accounts")
              .select("stripe_account_id, payouts_enabled")
              .eq("user_id", c.provider_user_id)
              .maybeSingle();
            if (!acct?.stripe_account_id || !acct.payouts_enabled) {
              const reason = "Provider Stripe account not active";
              await supabaseAdmin.rpc("fin_fail_cashout", { _cashout_id: c.id, _reason: reason } as never);
              results.push({ id: c.id, ok: false, reason: "no_stripe_account" });
              await notify(c.provider_user_id, "provider-cashout-failed", c.id,
                { amountUsd: formatUsd(c.amount_cents), reason });
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
              await notify(c.provider_user_id, "provider-cashout-completed", c.id,
                { amountUsd: formatUsd(c.amount_cents), transferId: tr.id });
            } catch (e) {
              const reason = getStripeErrorMessage(e);
              await supabaseAdmin.rpc("fin_fail_cashout", { _cashout_id: c.id, _reason: reason } as never);
              results.push({ id: c.id, ok: false, reason });
              await notify(c.provider_user_id, "provider-cashout-failed", c.id,
                { amountUsd: formatUsd(c.amount_cents), reason });
            }
          }
        } catch (e) {
          errorText = e instanceof Error ? e.message : String(e);
        }

        const processed = results.filter(r => r.ok).length;
        const failed = results.filter(r => !r.ok).length;
        await supabaseAdmin.rpc("fin_record_cron_run", {
          _job: "fin-cashout-tick",
          _ok: errorText === null,
          _processed: processed,
          _failed: failed,
          _error: errorText,
          _triggered_by: triggeredBy,
          _started_at: startedAt,
        } as never);

        if (errorText) return new Response(errorText, { status: 500 });
        return Response.json({ processed: results.length, results });
      },
    },
  },
});

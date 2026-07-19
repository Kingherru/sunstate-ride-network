import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: release trip payouts whose hold window has expired and whose payment
 * has been validated. Moves ledger from `pending` to `available` in the
 * provider balance. Runs every 15 minutes. Logs each run to fin_cron_runs
 * and emails the provider when funds move to available.
 */
export const Route = createFileRoute("/api/public/hooks/fin-release-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.FIN_CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const triggeredBy = url.searchParams.get("trigger") ?? "cron";
        const startedAt = new Date().toISOString();

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendFinanceEmail, formatUsd } = await import("@/lib/finance/notify.server");

        const released: string[] = [];
        const failed: Array<{ id: string; reason: string }> = [];
        let errorText: string | null = null;

        try {
          const { data: eligible, error } = await supabaseAdmin
            .from("trips")
            .select("id, assigned_to, fin_provider_net_cents")
            .eq("fin_payment_state", "validated")
            .eq("fin_payout_state", "holding")
            .lte("fin_payout_hold_until", new Date().toISOString())
            .not("fin_payout_hold_until", "is", null)
            .limit(200);
          if (error) throw new Error(error.message);

          for (const t of eligible ?? []) {
            const { error: e } = await supabaseAdmin.rpc("fin_release_to_balance", { _trip_id: t.id } as never);
            if (e) { failed.push({ id: t.id, reason: e.message }); continue; }
            released.push(t.id);

            // Notify provider — best-effort; failures do not fail the tick.
            if (t.assigned_to && t.fin_provider_net_cents) {
              try {
                const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(t.assigned_to);
                const email = userInfo?.user?.email;
                if (email) {
                  const { data: bal } = await supabaseAdmin
                    .from("provider_balances")
                    .select("available_cents")
                    .eq("provider_user_id", t.assigned_to)
                    .maybeSingle();
                  await sendFinanceEmail({
                    templateName: "provider-funds-available",
                    recipientEmail: email,
                    idempotencyKey: `fin-release-${t.id}`,
                    origin,
                    templateData: {
                      providerName: userInfo?.user?.user_metadata?.name ?? "there",
                      amountUsd: formatUsd(t.fin_provider_net_cents),
                      tripShortId: t.id.slice(0, 8),
                      availableBalanceUsd: formatUsd(bal?.available_cents ?? 0),
                    },
                  });
                }
              } catch { /* swallow email errors */ }
            }
          }
        } catch (e) {
          errorText = e instanceof Error ? e.message : String(e);
        }

        await supabaseAdmin.rpc("fin_record_cron_run", {
          _job: "fin-release-tick",
          _ok: errorText === null,
          _processed: released.length,
          _failed: failed.length,
          _error: errorText,
          _triggered_by: triggeredBy,
          _started_at: startedAt,
        } as never);

        if (errorText) return new Response(errorText, { status: 500 });
        return Response.json({ released: released.length, failed });
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron endpoint: automatically release payouts whose hold window has expired
 * and whose payment has been validated. Configured via pg_cron / external
 * scheduler to hit every 15 minutes.
 *
 * Requires header `x-fin-release-token` matching FIN_RELEASE_TOKEN secret.
 */
export const Route = createFileRoute("/api/public/hooks/fin-release-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-fin-release-token");
        const expected = process.env.FIN_RELEASE_TOKEN;
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: eligible, error } = await supabaseAdmin
          .from("trips")
          .select("id, fin_payment_state, fin_payout_state, fin_payout_hold_until, assigned_to, fin_provider_net_cents")
          .eq("fin_payment_state", "validated")
          .in("fin_payout_state", ["holding", "releasable"])
          .lte("fin_payout_hold_until", new Date().toISOString())
          .not("assigned_to", "is", null)
          .gt("fin_provider_net_cents", 0)
          .limit(100);

        if (error) return new Response(error.message, { status: 500 });

        const released: string[] = [];
        const failed: Array<{ id: string; reason: string }> = [];
        for (const t of eligible ?? []) {
          const { error: e } = await supabaseAdmin.rpc("fin_release_payout", {
            _trip_id: t.id, _transfer_ref: null,
          } as never);
          if (e) failed.push({ id: t.id, reason: e.message });
          else released.push(t.id);
        }
        return new Response(JSON.stringify({ released, failed }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});

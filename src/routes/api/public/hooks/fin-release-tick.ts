import { createFileRoute } from "@tanstack/react-router";

/**
 * Cron: release trip payouts whose hold window has expired and whose payment
 * has been validated. Moves ledger from `pending` to `available` in the
 * provider balance. Runs every 15 minutes.
 * Requires header `x-fin-release-token` = FIN_RELEASE_TOKEN secret.
 */
export const Route = createFileRoute("/api/public/hooks/fin-release-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey = request.headers.get("apikey");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!expected || apikey !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: eligible, error } = await supabaseAdmin
          .from("trips")
          .select("id")
          .eq("fin_payment_state", "validated")
          .eq("fin_payout_state", "holding")
          .lte("fin_payout_hold_until", new Date().toISOString())
          .not("fin_payout_hold_until", "is", null)
          .limit(200);
        if (error) return new Response(error.message, { status: 500 });

        const released: string[] = [];
        const failed: Array<{ id: string; reason: string }> = [];
        for (const t of eligible ?? []) {
          const { error: e } = await supabaseAdmin.rpc("fin_release_to_balance", { _trip_id: t.id } as never);
          if (e) failed.push({ id: t.id, reason: e.message });
          else released.push(t.id);
        }
        return Response.json({ released: released.length, failed });
      },
    },
  },
});

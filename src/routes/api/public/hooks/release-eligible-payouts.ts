// Public cron endpoint hit by pg_cron every 15 minutes to release payouts
// that have finished their 48h (standard) or Net-15 (Medicaid) hold window.
// Authenticated via the Supabase publishable/anon key (apikey header).
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/release-eligible-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY ||
          process.env.SUPABASE_ANON_KEY ||
          "";
        const provided = request.headers.get("apikey") || "";
        if (!expected || provided !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { attemptTripPayoutRelease } = await import("@/lib/payouts.server");

        const nowIso = new Date().toISOString();
        const { data: eligible, error } = await supabaseAdmin
          .from("trips")
          .select("id")
          .eq("payout_status", "pending")
          .lte("payout_eligible_at", nowIso)
          .limit(100);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const results: Array<{ id: string; status: string; reason?: string }> = [];
        for (const row of eligible ?? []) {
          try {
            const r = await attemptTripPayoutRelease({
              tripId: (row as { id: string }).id,
              actorUserId: null,
            });
            results.push({ id: r.tripId, status: r.status, reason: r.reason });
          } catch (e) {
            results.push({
              id: (row as { id: string }).id,
              status: "error",
              reason: e instanceof Error ? e.message : "unknown",
            });
          }
        }
        return Response.json({ ok: true, considered: eligible?.length ?? 0, results });
      },
    },
  },
});

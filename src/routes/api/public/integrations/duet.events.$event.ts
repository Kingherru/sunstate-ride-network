import { createFileRoute } from "@tanstack/react-router";

/**
 * Inbound Duet trip events (Duet → Broker).
 *   POST /api/public/integrations/duet/events/{slug}
 * Slugs: ride-scheduled, ride-unscheduled, will-call-initiated, on-the-way,
 * pickup-arrived, pickup-completed, dropoff-arrived, dropoff-completed,
 * ride-canceled, ride-rejected, no-show, gps-event
 *
 * Auth: `Authorization: Bearer <webhook secret>` — the secret the provider
 * saved in Integrations → Duet. Verified against the provider assigned to the
 * ride before anything is written.
 */
export const Route = createFileRoute("/api/public/integrations/duet/events/$event")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const json = (h: unknown, status: number) =>
          new Response(JSON.stringify(h), { status, headers: { "Content-Type": "application/json" } });

        const { duetEventFromSlug, duetrideAdapter } = await import("@/lib/integrations/duetride");
        const eventType = duetEventFromSlug(String((params as any).event ?? ""));
        if (!eventType) return json({ ok: false, error: "Unknown event type" }, 404);

        const raw = await request.text();
        let payload: any;
        try { payload = JSON.parse(raw); } catch { return json({ ok: false, error: "Invalid JSON body" }, 400); }
        const rideId = String(payload?.rideId ?? "");
        if (!rideId) return json({ ok: false, error: "Missing rideId" }, 400);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: trip } = await supabaseAdmin
          .from("trips").select("id, assigned_to").eq("duet_ride_id", rideId).maybeSingle();
        if (!trip?.assigned_to) return json({ ok: false, error: "Unknown rideId" }, 404);

        const { loadDuetConfig, applyDuetEvent } = await import("@/lib/duet.server");
        const cfg = await loadDuetConfig(trip.assigned_to);
        if (!cfg) return json({ ok: false, error: "Duet is not enabled for this provider" }, 403);

        const signature = request.headers.get("authorization") ?? request.headers.get("x-duet-signature");
        const valid = await duetrideAdapter.verifyWebhook(raw, signature, cfg);
        if (!valid) return json({ ok: false, error: "Invalid credentials" }, 401);

        const res = await applyDuetEvent({ eventType, payload });
        return res.ok ? json({ ok: true }, 200) : json({ ok: false, error: res.error }, 400);
      },
    },
  },
});

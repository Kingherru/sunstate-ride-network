import { createFileRoute } from "@tanstack/react-router";
import { createHmac } from "crypto";

/**
 * Webhook delivery worker.
 * - Auth: shared header `x-cron-secret` matching CRON_SECRET env, OR admin bearer.
 * - Fetches pending webhook_deliveries and POSTs to the target endpoint URL.
 * - Signs each request with HMAC-SHA256 using the endpoint's signing_secret.
 * - Provider-scoped payloads only ever contain that provider's data
 *   (isolation is enforced when the delivery row is created, not here).
 */
export const Route = createFileRoute("/api/public/webhooks/dispatch")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cronSecret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!cronSecret || provided !== cronSecret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: pending, error } = await (supabaseAdmin as any)
          .from("webhook_deliveries")
          .select("*")
          .eq("status", "pending")
          .lt("attempts", 5)
          .order("created_at", { ascending: true })
          .limit(50);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const results: Array<{ id: string; status: string; code?: number }> = [];

        for (const d of (pending ?? []) as any[]) {
          let endpointUrl: string | null = null;
          let secret: string | null = null;

          if (d.scope === "provider" && d.provider_endpoint_id) {
            const { data: ep } = await (supabaseAdmin as any)
              .from("provider_webhook_endpoints")
              .select("url, signing_secret, enabled, provider_user_id")
              .eq("id", d.provider_endpoint_id)
              .maybeSingle();
            if (!ep || !ep.enabled || ep.provider_user_id !== d.provider_user_id) {
              await (supabaseAdmin as any).from("webhook_deliveries").update({ status: "failed", last_response_body: "endpoint invalid or disabled" }).eq("id", d.id);
              continue;
            }
            endpointUrl = ep.url;
            secret = ep.signing_secret;
          } else if (d.scope === "platform" && d.platform_endpoint_id) {
            const { data: ep } = await (supabaseAdmin as any)
              .from("platform_webhook_endpoints")
              .select("url, signing_secret, enabled")
              .eq("id", d.platform_endpoint_id)
              .maybeSingle();
            if (!ep || !ep.enabled) {
              await (supabaseAdmin as any).from("webhook_deliveries").update({ status: "failed", last_response_body: "endpoint invalid or disabled" }).eq("id", d.id);
              continue;
            }
            endpointUrl = ep.url;
            secret = ep.signing_secret;
          }

          if (!endpointUrl || !secret) continue;

          const body = JSON.stringify({
            id: d.id,
            event: d.event_type,
            created_at: d.created_at,
            data: d.payload,
          });
          const timestamp = Math.floor(Date.now() / 1000).toString();
          const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

          try {
            const resp = await fetch(endpointUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "x-webhook-signature": `t=${timestamp},v1=${signature}`,
                "x-webhook-event": d.event_type,
              },
              body,
              signal: AbortSignal.timeout(10000),
            });
            const respText = (await resp.text()).slice(0, 500);
            const ok = resp.ok;
            await (supabaseAdmin as any).from("webhook_deliveries").update({
              status: ok ? "delivered" : (d.attempts + 1 >= 5 ? "failed" : "pending"),
              attempts: d.attempts + 1,
              last_response_status: resp.status,
              last_response_body: respText,
              last_attempted_at: new Date().toISOString(),
              delivered_at: ok ? new Date().toISOString() : null,
            }).eq("id", d.id);

            if (d.scope === "provider" && d.provider_endpoint_id) {
              await (supabaseAdmin as any).from("provider_webhook_endpoints").update(
                ok ? { last_success_at: new Date().toISOString() } : { last_failure_at: new Date().toISOString() }
              ).eq("id", d.provider_endpoint_id);
            }
            results.push({ id: d.id, status: ok ? "delivered" : "retry", code: resp.status });
          } catch (e: any) {
            await (supabaseAdmin as any).from("webhook_deliveries").update({
              status: d.attempts + 1 >= 5 ? "failed" : "pending",
              attempts: d.attempts + 1,
              last_response_body: String(e?.message ?? e).slice(0, 500),
              last_attempted_at: new Date().toISOString(),
            }).eq("id", d.id);
            results.push({ id: d.id, status: "error" });
          }
        }

        return Response.json({ processed: results.length, results });
      },
    },
  },
});

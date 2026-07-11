import { createServerFn } from "@tanstack/react-start";
import { createHmac } from "crypto";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EVENT_IDS = [
  "trip.assigned",
  "trip.status_changed",
  "driver.updated",
  "reservation.created",
  "*",
] as const;

const inputSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(100),
  url: z
    .string()
    .trim()
    .max(500)
    .url("Must be a valid URL"),
  events: z
    .array(z.enum(EVENT_IDS))
    .min(1, "Select at least one event")
    .max(20),
});

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
];

function validateUrlShape(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Invalid URL format");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("URL must use HTTPS");
  }
  if (parsed.username || parsed.password) {
    throw new Error("URL must not contain credentials");
  }
  const host = parsed.hostname;
  if (!host.includes(".") && host !== "localhost") {
    throw new Error("URL must use a fully-qualified hostname");
  }
  for (const p of PRIVATE_HOST_PATTERNS) {
    if (p.test(host)) throw new Error("URL host is not publicly routable");
  }
  return parsed;
}

async function pingReachable(url: string, timeoutMs = 5000): Promise<void> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ac.signal,
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "x-webhook-ping": "1",
        "user-agent": "MyFloridaNemt-Webhook-Validator/1.0",
      },
      body: JSON.stringify({ type: "ping", ts: Date.now() }),
    });
    // Any HTTP response (even 4xx/5xx) means the endpoint is reachable.
    // Only network failure / timeout / DNS should fail validation.
    void res.status;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Endpoint did not respond within ${timeoutMs}ms`);
    }
    throw new Error(`Endpoint unreachable: ${err?.message ?? "network error"}`);
  } finally {
    clearTimeout(t);
  }
}

export const createProviderWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const parsed = validateUrlShape(data.url);
    await pingReachable(parsed.toString());

    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("provider_webhook_endpoints" as any)
      .insert({
        provider_user_id: userId,
        label: data.label,
        url: parsed.toString(),
        events: data.events,
        enabled: true,
      } as any)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id };
  });

export const testProviderWebhookEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ep, error } = await supabase
      .from("provider_webhook_endpoints" as any)
      .select("id, url, signing_secret, enabled, provider_user_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ep || (ep as any).provider_user_id !== userId) throw new Error("Endpoint not found");
    if (!(ep as any).enabled) throw new Error("Endpoint is disabled");

    const url = (ep as any).url as string;
    const secret = (ep as any).signing_secret as string;
    const body = JSON.stringify({
      id: `test_${Date.now()}`,
      event: "webhook.test",
      created_at: new Date().toISOString(),
      data: {
        message: "This is a test event from MyFloridaNemt",
        provider_user_id: userId,
      },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

    const startedAt = Date.now();
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-signature": `t=${timestamp},v1=${signature}`,
          "x-webhook-event": "webhook.test",
          "user-agent": "MyFloridaNemt-Webhook-Test/1.0",
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      const text = (await resp.text()).slice(0, 1000);
      const ms = Date.now() - startedAt;
      const nowIso = new Date().toISOString();
      await supabase
        .from("provider_webhook_endpoints" as any)
        .update(resp.ok ? { last_success_at: nowIso } : { last_failure_at: nowIso })
        .eq("id", (ep as any).id);
      return {
        ok: resp.ok,
        status: resp.status,
        durationMs: ms,
        body: text,
      };
    } catch (e: any) {
      await supabase
        .from("provider_webhook_endpoints" as any)
        .update({ last_failure_at: new Date().toISOString() })
        .eq("id", (ep as any).id);
      const msg = e?.name === "TimeoutError" || e?.name === "AbortError"
        ? "Request timed out after 10s"
        : String(e?.message ?? e);
      return {
        ok: false,
        status: 0,
        durationMs: Date.now() - startedAt,
        body: msg,
      };
    }
  });

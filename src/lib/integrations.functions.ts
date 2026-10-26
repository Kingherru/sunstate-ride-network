import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const vendorSchema = z.enum(["hibambi", "routegenie", "duetride"]);
async function requireProviderOwner(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.from('workspace_members').select('role,is_contractor,workspaces!inner(account_type,status)').eq('user_id', context.userId).is('removed_at', null);
  const owners = (data ?? []).filter((m: any) => m.role === 'owner' && !m.is_contractor && m.workspaces.account_type === 'provider' && m.workspaces.status === 'active');
  if (error || owners.length !== 1) throw new Error('One active provider-owner workspace required for legacy integrations.');
}

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await requireProviderOwner(context);
    const { data, error } = await supabase
      .from("provider_integrations")
      .select("id, vendor, enabled, last_sync_at, config, created_at")
      .eq("provider_id", userId);
    if (error) throw error;
    return (data ?? []).map(row => {
      const config = (row.config ?? {}) as Record<string, unknown>;
      return { ...row, config: { transportationProviderId: typeof config.transportationProviderId === 'string' ? config.transportationProviderId : '', baseUrl: typeof config.baseUrl === 'string' ? config.baseUrl : '', hasApiSecret: typeof config.apiSecretEncrypted === 'string' } };
    });
  });

export const upsertIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      vendor: vendorSchema,
      api_key: z.string().min(8).max(512),
      webhook_secret: z.string().min(8).max(256).optional(),
      enabled: z.boolean().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireProviderOwner(context);
    // AES-256-GCM encrypt secrets in the trusted server runtime before they
    // ever hit the database. Only ciphertext (v1:<iv>:<tag>:<ct>) is stored.
    const { encryptSecret } = await import("./integrations-crypto.server");

    // Merge with any previously stored config so unchanged secrets survive.
    const { data: prior } = await supabase
      .from("provider_integrations")
      .select("config,webhook_secret")
      .eq("provider_id", userId)
      .eq("vendor", data.vendor)
      .maybeSingle();

    const requested = data.config ?? {};
    const incoming: Record<string, unknown> = {};
    if (typeof requested.transportationProviderId === 'string') incoming.transportationProviderId = requested.transportationProviderId;
    if (typeof requested.baseUrl === 'string') {
      const url = new URL(requested.baseUrl);
      if (url.protocol !== 'https:' || !['api.duetride.com'].includes(url.hostname) || url.username || url.password) throw new Error('Use the approved dispatch API address.');
      incoming.baseUrl = url.origin;
    }
    if (typeof requested.apiSecret === 'string') incoming.apiSecret = requested.apiSecret;
    if (typeof incoming.apiSecret === "string" && incoming.apiSecret) {
      incoming.apiSecretEncrypted = encryptSecret(incoming.apiSecret);
    }
    delete incoming.apiSecret;
    const merged = { ...((prior?.config ?? {}) as Record<string, unknown>), ...incoming };

    const { error } = await supabase
      .from("provider_integrations")
      .upsert({
        provider_id: userId,
        vendor: data.vendor,
        api_key_encrypted: encryptSecret(data.api_key),
        webhook_secret: data.webhook_secret ? encryptSecret(data.webhook_secret) : prior?.webhook_secret ?? null,
        enabled: data.enabled ?? false,
        config: merged as any,
      }, { onConflict: "provider_id,vendor" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ vendor: vendorSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await requireProviderOwner(context);
    const { error } = await supabase
      .from("provider_integrations")
      .delete()
      .eq("provider_id", userId)
      .eq("vendor", data.vendor);
    if (error) throw error;
    return { ok: true };
  });

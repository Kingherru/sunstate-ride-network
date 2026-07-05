import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const vendorSchema = z.enum(["hibambi", "routegenie", "duetride"]);

export const listIntegrations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("provider_integrations")
      .select("id, vendor, enabled, last_sync_at, config, created_at")
      .eq("provider_id", userId);
    if (error) throw error;
    return data ?? [];
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
    // NOTE: api_key is stored "encrypted at rest" via Postgres' built-in
    // disk encryption only — wrap with pgp_sym_encrypt + a server-only key
    // before production use.
    const { error } = await supabase
      .from("provider_integrations")
      .upsert({
        provider_id: userId,
        vendor: data.vendor,
        api_key_encrypted: data.api_key,
        webhook_secret: data.webhook_secret ?? null,
        enabled: data.enabled ?? false,
        config: (data.config ?? {}) as any,
      }, { onConflict: "provider_id,vendor" });
    if (error) throw error;
    return { ok: true };
  });

export const deleteIntegration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ vendor: vendorSchema }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("provider_integrations")
      .delete()
      .eq("provider_id", userId)
      .eq("vendor", data.vendor);
    if (error) throw error;
    return { ok: true };
  });

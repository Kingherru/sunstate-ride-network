import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type NetworkProviderRow = {
  workspace_id: string;
  business_name: string;
  mfn_id: string | null;
  description: string | null;
  business_contact_email: string | null;
  business_contact_phone: string | null;
  service_types: string[];
  counties: string[];
  cities: string[];
  zips: string[];
  hours: string | null;
  medical_delivery: boolean;
  accepting_connections: boolean;
  is_saved: boolean;
};

const filtersSchema = z.object({
  search: z.string().max(200).optional(),
  service_type: z.string().max(100).optional(),
  county: z.string().max(100).optional(),
  city: z.string().max(100).optional(),
  zip: z.string().max(10).optional(),
  medical_delivery: z.boolean().optional(),
  accepting: z.boolean().optional(),
  saved_only: z.boolean().optional(),
});
export type NetworkProviderFilters = z.infer<typeof filtersSchema>;

/**
 * Shared Provider Network directory: used by Find Providers, Saved Providers
 * and the provider portal Network page. Only verified, active, visible,
 * non-test, non-suspended provider workspaces are returned, with only the
 * business fields the provider approved for network discovery.
 *
 * No coordinates are stored or used here, so there is no mileage-radius
 * search — that is left for the future trip-distribution pass.
 */
export const listNetworkProviders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => filtersSchema.parse(i ?? {}))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("list_network_providers", {
      _search: data.search,
      _service_type: data.service_type,
      _county: data.county,
      _city: data.city,
      _zip: data.zip,
      _medical_delivery: data.medical_delivery,
      _accepting: data.accepting,
      _saved_only: data.saved_only ?? false,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, results: (rows ?? []) as NetworkProviderRow[] };
  });

export const saveNetworkProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ provider_workspace_id: z.string().uuid(), notes: z.string().max(500).optional() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_network_providers")
      .upsert({ user_id: context.userId, provider_workspace_id: data.provider_workspace_id, notes: data.notes ?? null }, { onConflict: "user_id,provider_workspace_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unsaveNetworkProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ provider_workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("saved_network_providers")
      .delete()
      .eq("user_id", context.userId)
      .eq("provider_workspace_id", data.provider_workspace_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Get the current provider workspace's own network profile (owner/admin only; RLS-enforced). */
export const getMyNetworkProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspace_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("provider_network_profiles")
      .select("*")
      .eq("workspace_id", data.workspace_id)
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    const { data: ws } = await context.supabase
      .from("workspaces")
      .select("provider_verified")
      .eq("id", data.workspace_id)
      .maybeSingle();
    return { ok: true as const, profile: row, verified: !!ws?.provider_verified };
  });

const profileSchema = z.object({
  workspace_id: z.string().uuid(),
  description: z.string().max(2000).optional().nullable(),
  business_contact_email: z.string().email().max(254).optional().nullable().or(z.literal("")),
  business_contact_phone: z.string().max(32).optional().nullable(),
  service_types: z.array(z.string().max(100)).max(30).default([]),
  counties: z.array(z.string().max(100)).max(70).default([]),
  cities: z.array(z.string().max(100)).max(100).default([]),
  zips: z.array(z.string().max(10)).max(200).default([]),
  hours: z.string().max(500).optional().nullable(),
  medical_delivery: z.boolean().default(false),
  accepting_connections: z.boolean().default(true),
  visible: z.boolean().default(false),
});

/** Create or update the current provider's own Network Profile. Verification can never be set here. */
export const saveNetworkProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => profileSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { workspace_id, ...rest } = data;
    const { error } = await context.supabase
      .from("provider_network_profiles")
      .upsert({ workspace_id, ...rest, business_contact_email: rest.business_contact_email || null }, { onConflict: "workspace_id" });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

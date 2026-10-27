import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
export type ProviderBadgeLevel = 'semi' | 'blue' | 'gold' | 'none' | null;
export type ProviderBadge = { workspace_id: string; level: ProviderBadgeLevel; legacy_verified: boolean; paused_reason: string | null };
export const listProviderBadges = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ workspaceIds: z.array(z.string().uuid()).max(200) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc('provider_verification_badges', { _workspaces: data.workspaceIds });
    if (error) throw new Error('Provider badge status unavailable.');
    return (rows ?? []) as unknown as ProviderBadge[];
  });
export const pauseProviderBadge = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ workspaceId: z.string().uuid(), category: z.enum(['payment','compliance','security']), reason: z.string().trim().min(10).max(500), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('admin_pause_provider_badge', { _workspace: data.workspaceId, _category: data.category, _reason: data.reason, _confirmed: data.confirmed });
    if (error) throw new Error('Badge pause requires scoped billing permission, a documented reason and confirmation.');
    return { ok: true };
  });
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { verificationDetailsInput } from './verification-evidence-rules';
import type { Json } from '@/integrations/supabase/types';
export type ProviderBadgeLevel = 'semi' | 'blue' | 'gold' | 'none' | null;
export type ProviderBadge = { workspace_id: string; level: ProviderBadgeLevel; legacy_verified: boolean; paused_reason: string | null };
export type VerificationSummary = { workspace_id: string; level: ProviderBadgeLevel; paused_reason: string | null; requirements: { label: string; complete: boolean }[]; documents: { kind: string; label: string; status: string }[] };
export const getVerificationSummary = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('provider_verification_summary', { _workspace: data.workspaceId });
    if (error) throw new Error('Verification evidence is unavailable for this account.');
    return result as unknown as VerificationSummary | null;
  });
export const getVerificationDetails = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc('get_provider_verification_details', { _workspace: data.workspaceId });
    if (error) throw new Error('Business details are unavailable.');
    return result as { [key: string]: Json | undefined };
  });
export const saveVerificationDetails = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => verificationDetailsInput.parse(v))
  .handler(async ({ data, context }) => {
    const { workspaceId, ...details } = data;
    const { error } = await context.supabase.rpc('save_provider_verification_details', { _workspace: workspaceId, _details: details });
    if (error) throw new Error('Save your service profile first, then confirm business details as its owner or administrator.');
    return { ok: true };
  });
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
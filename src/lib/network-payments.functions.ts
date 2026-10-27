import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { networkDisputeInput, type NetworkPaymentState } from './network-payment-rules';
export type NetworkPaymentRow = { id: string; mfn_id: string; source_mfn_id: string; completed_at: string | null; due_at: string | null; initiated_at: string | null; paid_at: string | null; dispute_opened_at: string | null; dispute_resolved_at: string | null; state: NetworkPaymentState; can_complete: boolean; can_dispute: boolean; can_resolve: boolean };
export const listNetworkPayments = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('network_list_payments');
  if (error) throw new Error('Network payments unavailable.');
  return (data ?? []) as unknown as NetworkPaymentRow[];
});
export const recordNetworkCompletion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ distributionId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('network_record_completion', { _distribution: data.distributionId, _confirmed: data.confirmed });
    if (error) throw new Error(error.message); return { ok: true };
  });
export const openNetworkPaymentDispute = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => networkDisputeInput.parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('network_open_payment_dispute', { _distribution: data.distributionId, _reason: data.reason, _confirmed: data.confirmed });
    if (error) throw new Error(error.message); return { ok: true };
  });
export const resolveNetworkPaymentDispute = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ distributionId: z.string().uuid(), reason: z.string().trim().min(10).max(500), confirmed: z.literal(true) }).strict().parse(v)).handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('network_resolve_payment_dispute', { _distribution: data.distributionId, _reason: data.reason, _confirmed: data.confirmed });
    if (error) throw new Error(error.message); return { ok: true };
  });
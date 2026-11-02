import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

export type SettlementRow = {
  id: string; mfn_id: string; source_mfn_id: string | null; side: 'sender' | 'receiver' | 'admin';
  sender_workspace_mfn_id: string | null; receiver_workspace_mfn_id: string | null;
  receiver_payout_cents: number; network_fee_cents: number; processing_fee_cents: number | null; processing_fee_rule: string;
  sender_total_due_cents: number; currency: string; completed_at: string | null; review_window_ends_at: string | null;
  payment_deadline_at: string | null; payment_succeeded_at: string | null; verification_tier_snapshot: string | null;
  hold_days: number | null; release_eligible_at: string | null; dispute_opened_at: string | null; dispute_resolved_at: string | null;
  transferred: boolean; paid_out: boolean; stripe_environment: string; state: string; created_at: string;
  events: { event_type: string; actor_mfn_id: string | null; created_at: string }[];
};

export const listSettlements = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('network_list_settlements');
  if (error) throw new Error('Settlements unavailable.');
  return (data ?? []) as unknown as SettlementRow[];
});

export const fileSettlementDispute = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid(), category: z.enum(['completion_missing', 'service_not_completed', 'amount_incorrect', 'security_issue']), explanation: z.string().trim().max(1000).default(''), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('network_file_dispute', { _settlement: data.settlementId, _category: data.category, _explanation: data.explanation });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type DisputeRow = { id: string; settlement_mfn_id: string; category: string; status: string; created_at: string; sender: string | null; receiver: string | null };
export const listAdminDisputes = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('network_list_disputes');
  if (error) throw new Error('Dispute queue unavailable.');
  return (data ?? []) as unknown as DisputeRow[];
});

/** Own payout-account readiness only (RLS-scoped); never returns the Stripe account id. */
export const getConnectReadiness = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data } = await context.supabase.from('provider_payout_accounts').select('status,payouts_enabled,charges_enabled,details_submitted,requirements_due,environment').eq('user_id', context.userId).maybeSingle();
  return data ? { status: data.status as string, payouts_enabled: !!data.payouts_enabled, charges_enabled: !!data.charges_enabled, details_submitted: !!data.details_submitted, requirements_due: Array.isArray(data.requirements_due) ? data.requirements_due.map(String) : [], environment: data.environment as string | null } : null;
});

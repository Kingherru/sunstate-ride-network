import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';

/** Pass 3O-B: test-mode Network settlement payments, transfers and dispute resolution.
 * All amounts come from the database fee policy and locked settlement terms; never from the client. */
const Env = z.enum(['sandbox', 'live']);
const Method = z.enum(['card', 'ach']);
/** ACH stays unavailable until the Stripe test account's ACH Direct Debit setup is confirmed. */
export const ACH_AVAILABLE = false;

async function liveCollectionAllowed(supabase: any) {
  const { data } = await supabase.from('platform_launch_flags').select('enabled').eq('key', 'network_live_settlement_collection').maybeSingle();
  return data?.enabled === true;
}

export type PaymentQuote = { receiver_payout_cents: number; network_fee_cents: number; processing_fee_cents: number; total_cents: number; policy_version: number; method: 'card' | 'ach'; sandbox_estimate: boolean };

export const getSettlementPaymentQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid(), method: Method, environment: Env }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: q, error } = await context.supabase.rpc('network_payment_quote', { _settlement: data.settlementId, _method: data.method, _env: data.environment });
    if (error || !q) return { error: 'This payment method is not available.' } as const;
    return { quote: q as unknown as PaymentQuote } as const;
  });

export const confirmSettlementCompletion = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('network_confirm_completion', { _settlement: data.settlementId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Creates (or reuses) the locked attempt and its PaymentIntent. Returns only the client secret and locked amounts. */
export const startSettlementPayment = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid(), method: Method, environment: Env, acknowledged: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    if (data.method === 'ach' && !ACH_AVAILABLE) return { error: 'Bank (ACH) payment is not available yet.' } as const;
    if (data.environment === 'live' && !(await liveCollectionAllowed(context.supabase))) return { error: 'Live Network payments are not turned on. Test mode only.' } as const;
    const { data: att, error } = await context.supabase.rpc('network_prepare_payment_attempt', { _settlement: data.settlementId, _method: data.method, _env: data.environment });
    if (error || !att) return { error: error?.message ?? 'Not available' } as const;
    const a = att as unknown as { id: string; mfn_id: string; settlement_mfn_id: string; transfer_group: string; idempotency_key: string; total_cents: number; receiver_payout_cents: number; network_fee_cents: number; processing_fee_cents: number; policy_version: number };
    try {
      const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      const stripe = createStripeClient(data.environment);
      const { data: row } = await supabaseAdmin.from('network_payment_attempts').select('payment_intent_ref').eq('id', a.id).single();
      try {
        const intent = row?.payment_intent_ref
          ? await stripe.paymentIntents.retrieve(row.payment_intent_ref)
          : await stripe.paymentIntents.create({
              amount: a.total_cents, currency: 'usd', payment_method_types: ['card'],
              transfer_group: a.transfer_group,
              description: `MY FLORIDA NEMT Network settlement ${a.settlement_mfn_id}`,
              metadata: { settlement_mfn_id: a.settlement_mfn_id, attempt_mfn_id: a.mfn_id, category: 'network_settlement', fee_policy_version: String(a.policy_version) },
            }, { idempotencyKey: a.idempotency_key });
        if (!row?.payment_intent_ref) {
          await supabaseAdmin.from('network_payment_attempts').update({ payment_intent_ref: intent.id }).eq('id', a.id).is('payment_intent_ref', null);
        }
        if (intent.amount !== a.total_cents) return { error: 'Payment amount mismatch; nothing was charged.' } as const;
        return { clientSecret: intent.client_secret ?? '', attempt: { mfn_id: a.mfn_id, total_cents: a.total_cents, receiver_payout_cents: a.receiver_payout_cents, network_fee_cents: a.network_fee_cents, processing_fee_cents: a.processing_fee_cents } } as const;
      } catch (e) { return { error: getStripeErrorMessage(e) } as const; }
    } catch { return { error: 'Payments are not configured.' } as const; }
  });

export type AdminSettlementDetail = {
  attempts: { mfn_id: string; method: string; total_cents: number; processing_fee_cents: number; policy_version: number; status: string; error_code: string | null; actor: string | null; created_at: string; confirmed_at: string | null }[];
  transfer: { amount_cents: number; status: string; transferred_at: string | null; reversed_at: string | null; error_code: string | null } | null;
  disputes: { id: string; category: string; explanation: string | null; evidence_count: number; status: string; resolution: string | null; resolution_reason: string | null; resolved_at: string | null; resolved_by: string | null; opened_by: string | null; created_at: string }[];
  adjustments: { version: number; delta_receiver_cents: number; reason: string; actor: string | null; created_at: string }[];
  receiver_connect_ready: boolean; chargeback_status: string | null; refunded_at: string | null; payout_status: string | null; transfer_status: string | null;
  distribution_id: string | null; is_master: boolean;
};
export const getAdminSettlementDetail = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid() }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: d, error } = await context.supabase.rpc('network_admin_settlement_detail', { _settlement: data.settlementId });
    if (error) throw new Error('Not available');
    return d as unknown as AdminSettlementDetail;
  });

export const getExclusionReasons = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ distributionId: z.string().uuid() }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: d, error } = await context.supabase.rpc('network_admin_exclusion_reasons', { _distribution: data.distributionId });
    if (error) throw new Error('Master Admin required.');
    return (d ?? []) as unknown as { provider_mfn_id: string | null; reason_code: string; recorded_at: string }[];
  });

/** Master Admin, test mode only. Sender outcome on a paid settlement issues an idempotent test refund (and reversal if transferred). */
export const resolveNetworkDispute = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ disputeId: z.string().uuid(), outcome: z.enum(['sender', 'receiver', 'partial']), reason: z.string().trim().min(10).max(1000), adjustCents: z.number().int().positive().optional(), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase.rpc('network_admin_resolve_dispute', { _dispute: data.disputeId, _outcome: data.outcome, _reason: data.reason, _adjust_cents: data.adjustCents ?? 0 });
    if (error) return { error: error.message } as const;
    const res = r as unknown as { settlement_id: string; paid: boolean; transferred: boolean };
    if (data.outcome !== 'sender' || !res.paid) return { ok: true } as const;
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    const { data: s } = await supabaseAdmin.from('network_settlements').select('id,mfn_id,charge_ref,transfer_ref,stripe_environment,refunded_at').eq('id', res.settlement_id).single();
    if (!s || s.stripe_environment !== 'sandbox' || !s.charge_ref || s.refunded_at) return { ok: true } as const;
    try {
      const stripe = createStripeClient('sandbox');
      if (s.transfer_ref) await stripe.transfers.createReversal(s.transfer_ref, { metadata: { settlement_mfn_id: s.mfn_id } }, { idempotencyKey: `nsr_${s.id}` });
      await stripe.refunds.create({ charge: s.charge_ref, metadata: { settlement_mfn_id: s.mfn_id } }, { idempotencyKey: `nsf_${s.id}` });
      return { ok: true, note: 'Test refund requested; status updates when Stripe confirms.' } as const;
    } catch (e) { return { error: `Resolved, but the test refund failed: ${getStripeErrorMessage(e)}` } as const; }
  });

/** Master Admin, test mode only, after the full hold and with no open dispute. No bypass. */
export const processEligibleTestSettlement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid(), confirmed: z.literal(true) }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: claim, error } = await supabaseAdmin.rpc('network_claim_transfer', { _settlement: data.settlementId, _env: 'sandbox', _actor: context.userId });
    if (error || !claim) return { error: error?.message ?? 'Not eligible' } as const;
    const c = claim as unknown as { amount_cents: number; destination: string; idempotency_key: string; transfer_group: string; charge_ref: string; settlement_mfn_id: string };
    const { createStripeClient, getStripeErrorMessage } = await import('@/lib/stripe.server');
    try {
      const tr = await createStripeClient('sandbox').transfers.create({ amount: c.amount_cents, currency: 'usd', destination: c.destination, transfer_group: c.transfer_group, source_transaction: c.charge_ref, metadata: { settlement_mfn_id: c.settlement_mfn_id, category: 'network_settlement' } }, { idempotencyKey: c.idempotency_key });
      await supabaseAdmin.rpc('network_record_transfer', { _transfer_ref: tr.id, _settlement_mfn: c.settlement_mfn_id, _status: 'created', _error: '' });
      return { ok: true } as const;
    } catch (e) {
      const msg = getStripeErrorMessage(e);
      await supabaseAdmin.rpc('network_record_transfer', { _transfer_ref: '', _settlement_mfn: c.settlement_mfn_id, _status: 'failed', _error: msg.slice(0, 80) });
      return { error: msg } as const;
    }
  });

export type AdminAttemptFees = {
  attempts: { mfn_id: string; method: string; policy_version: number; sandbox_estimate: boolean | null; subtotal_cents: number; receiver_payout_cents: number; network_fee_cents: number; processing_fee_cents: number; total_cents: number; percent_bps: number | null; fixed_cents: number | null; cap_cents: number | null; reported_processor_fee_cents: number | null; variance_cents: number | null; status: string }[];
  platform_webhook_last: string | null; connect_webhook_last: string | null; connect_secret_configured: boolean;
};
/** Read-only fee recovery and webhook readiness for scoped admins. Never exposes secrets, only whether one is configured. */
export const getAdminAttemptFees = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ settlementId: z.string().uuid() }).strict().parse(v))
  .handler(async ({ data, context }) => {
    const { data: d, error } = await context.supabase.rpc('network_admin_attempt_fees', { _settlement: data.settlementId });
    if (error || !d) throw new Error('Not available');
    const { connectWebhookSecretConfigured } = await import('@/lib/stripe.server');
    return { ...(d as unknown as Omit<AdminAttemptFees, 'connect_secret_configured'>), connect_secret_configured: connectWebhookSecretConfigured('sandbox') } as AdminAttemptFees;
  });

import type { StripeEnv } from '@/lib/stripe.server';

/** Webhook reconciliation for Network settlements. Uses only server-held Stripe references. */
async function admin() { return (await import('@/integrations/supabase/client.server')).supabaseAdmin; }

export async function alreadyProcessed(eventId: string | undefined) {
  if (!eventId) return false;
  const { data } = await (await admin()).from('network_stripe_events').select('event_id').eq('event_id', eventId).maybeSingle();
  return !!data;
}
export async function markProcessed(eventId: string | undefined, type: string, env: StripeEnv, source: 'platform' | 'connect' = 'platform') {
  if (!eventId) return;
  await (await admin()).from('network_stripe_events').upsert({ event_id: eventId, event_type: type, environment: env, source }, { onConflict: 'event_id', ignoreDuplicates: true });
}

export async function reconcileSettlementIntent(obj: any, type: string, env: StripeEnv) {
  if (obj?.metadata?.category !== 'network_settlement' || !obj.id) return;
  const status = type === 'payment_intent.succeeded' ? 'succeeded' : type === 'payment_intent.canceled' ? 'canceled' : type === 'payment_intent.payment_failed' ? 'failed' : 'processing';
  const charge = typeof obj.latest_charge === 'string' ? obj.latest_charge : obj.latest_charge?.id ?? '';
  const { error } = await (await admin()).rpc('network_record_attempt_result', { _intent: obj.id, _env: env, _status: status, _amount_received: obj.amount_received ?? 0, _charge: charge, _error: obj.last_payment_error?.code ?? '' });
  if (error) throw new Error('Settlement payment evidence could not be saved.');
  if (status === 'succeeded' && charge) await recordProcessorFee(obj.id, charge, env);
}

/** Reads Stripe's actual fee for reconciliation only. A variance is recorded, never charged again. */
async function recordProcessorFee(intentId: string, chargeId: string, env: StripeEnv) {
  try {
    const { createStripeClient } = await import('@/lib/stripe.server');
    const ch = await createStripeClient(env).charges.retrieve(chargeId, { expand: ['balance_transaction'] });
    const fee = (ch.balance_transaction as { fee?: number } | null)?.fee;
    if (typeof fee === 'number') await (await admin()).rpc('network_record_processor_fee', { _intent: intentId, _env: env, _fee: fee });
  } catch { /* fee report is optional evidence; payment state is already saved */ }
}

export async function reconcileSettlementCharge(obj: any, type: string, env: StripeEnv) {
  const chargeId = type.startsWith('charge.dispute') ? obj?.charge : obj?.id;
  if (!chargeId) return;
  const refunded = type === 'charge.refunded' && (obj.refunded || (obj.amount_refunded ?? 0) > 0);
  const dispute = type.startsWith('charge.dispute') ? String(obj.status ?? 'needs_response') : undefined;
  await (await admin()).rpc('network_record_charge_state', { _charge: typeof chargeId === 'string' ? chargeId : chargeId.id, _env: env, _refunded: !!refunded, _dispute: dispute as string });
}

export async function reconcileSettlementTransfer(obj: any, type: string) {
  const mfn = obj?.metadata?.settlement_mfn_id;
  if (!mfn || obj?.metadata?.category !== 'network_settlement') return;
  await (await admin()).rpc('network_record_transfer', { _transfer_ref: obj.id, _settlement_mfn: mfn, _status: type === 'transfer.reversed' ? 'reversed' : 'created', _error: '' });
}

/** Connect payout events arrive with event.account (connected account). No bank details are stored. */
export async function reconcileSettlementPayout(obj: any, type: string, account: string | undefined) {
  if (!account || !obj?.id) return;
  await (await admin()).rpc('network_record_payout', { _account: account, _payout: obj.id, _status: type === 'payout.paid' ? 'paid' : 'failed', _payout_created: new Date((obj.created ?? Date.now() / 1000) * 1000).toISOString() });
}

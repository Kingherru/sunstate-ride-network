import { createStripeClient, type StripeEnv } from './stripe.server';
import { qualifiesNetworkSettlement } from './verification-evidence-rules';

/** Read current Stripe evidence only. Never charge, transfer, refund or create accounts. */
export async function reconcileConnectEvidence(object: { id?: string }, env: StripeEnv) {
  if (!object.id) return;
  const stripe = createStripeClient(env);
  const account = await stripe.accounts.retrieve(object.id);
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: existing, error } = await supabaseAdmin.from('provider_payout_accounts').select('user_id,workspace_id,environment').eq('stripe_account_id', account.id).maybeSingle();
  if (error) throw new Error('Connect evidence unavailable.');
  // A legacy account without an environment cannot prove live business entitlement.
  if (!existing || existing.environment !== env) return;
  const workspaceId = existing.workspace_id ?? account.metadata?.workspaceId;
  if (!workspaceId) return;
  const { data: owner } = await supabaseAdmin.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('workspace_id', workspaceId).eq('user_id', existing.user_id).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null).maybeSingle();
  if (!owner || owner.workspaces.account_type !== 'provider' || owner.workspaces.is_test_account) return;
  const requirements = account.requirements;
  const identityReady = !!account.details_submitted && !!account.charges_enabled && !!account.payouts_enabled &&
    !requirements?.disabled_reason && (requirements?.currently_due?.length ?? 0) === 0 && (requirements?.past_due?.length ?? 0) === 0 && (requirements?.pending_verification?.length ?? 0) === 0;
  const { error: writeError } = await supabaseAdmin.from('provider_payout_accounts').update({ workspace_id: workspaceId, identity_ready: identityReady, status: identityReady ? 'active' : requirements?.disabled_reason ? 'restricted' : 'pending', payouts_enabled: !!account.payouts_enabled, charges_enabled: !!account.charges_enabled, details_submitted: !!account.details_submitted, requirements_due: requirements ?? null, updated_at: new Date().toISOString() }).eq('user_id', existing.user_id).eq('stripe_account_id', account.id).eq('environment', env);
  if (writeError) throw new Error('Connect evidence could not be saved.');
}

export async function reconcileNetworkIntent(object: { id?: string }, env: StripeEnv) {
  if (!object.id) return;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: obligation, error } = await supabaseAdmin.from('trip_distributions').select('id,amount_cents,network_stripe_payment_intent_id,network_payment_environment,network_recipient_account_id').eq('network_stripe_payment_intent_id', object.id).eq('network_payment_environment', env).maybeSingle();
  if (error) throw new Error('Network payment linkage unavailable.');
  if (!obligation) return; // Never infer Network payment from trip_id or arbitrary metadata.
  const stripe = createStripeClient(env);
  const intent = await stripe.paymentIntents.retrieve(object.id);
  const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
  const recipient = intent.transfer_data?.destination;
  const destination = typeof recipient === 'string' ? recipient : recipient?.id ?? null;
  const paid = qualifiesNetworkSettlement({ environment: env, linkedIntent: obligation.network_stripe_payment_intent_id ?? '', intentId: intent.id, status: intent.status, currency: intent.currency, received: intent.amount_received, expected: obligation.amount_cents ?? 0, recipientAccount: obligation.network_recipient_account_id, destination, refunded: !!charge?.refunded || (charge?.amount_refunded ?? 0) > 0, disputed: !!charge?.disputed });
  const refunded = !!charge?.refunded || (charge?.amount_refunded ?? 0) > 0;
  const state = refunded ? 'refunded' : charge?.disputed ? 'disputed' : paid ? 'paid' : intent.status === 'canceled' || intent.last_payment_error ? 'failed' : 'processing';
  // Payment initiation is not intent creation time. It requires an observed successful charge.
  const initiatedAt = charge && ['succeeded', 'processing'].includes(intent.status) ? new Date(charge.created * 1000).toISOString() : null;
  const { error: saveError } = await supabaseAdmin.rpc('record_network_stripe_evidence', { _distribution: obligation.id, _intent: intent.id, _environment: env, _state: state, _initiated: initiatedAt ?? undefined, _paid: paid ? initiatedAt ?? undefined : undefined });
  if (saveError) throw new Error('Network payment evidence could not be saved.');
}

export async function reconcileNetworkCharge(object: { id?: string; charge?: string }, env: StripeEnv) {
  const ref = object.charge ?? object.id;
  if (!ref) return;
  const charge = await createStripeClient(env).charges.retrieve(ref);
  const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (intent) await reconcileNetworkIntent({ id: intent }, env);
}
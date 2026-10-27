import { type StripeEnv, createStripeClient } from './stripe.server';
import { isQualifyingMembershipInvoice, PROVIDER_MEMBERSHIP_PRICE } from './membership-invoice-rules';
import { MEMBERSHIP_PRICING, NETWORK_ADDON_PRICE } from './membership-pricing';

/** Read-only Stripe reconciliation; never creates customers, charges or subscriptions. */
export async function reconcileMembershipInvoice(invoiceObject: any, env: StripeEnv) {
  if (env !== 'live' || !invoiceObject?.id) return;
  const stripe = createStripeClient(env);
  // Retrieve current state so replays/older deliveries cannot revive a refunded invoice.
  const incomingInvoice = await stripe.invoices.retrieve(invoiceObject.id);
  const incomingSub = incomingInvoice.parent?.subscription_details?.subscription;
  const incomingSubId = typeof incomingSub === 'string' ? incomingSub : incomingSub?.id;
  if (!incomingSubId) return;
  const currentSubscription = await stripe.subscriptions.retrieve(incomingSubId);
  const latestInvoice = currentSubscription.latest_invoice;
  const latestInvoiceId = typeof latestInvoice === 'string' ? latestInvoice : latestInvoice?.id;
  const invoice = await stripe.invoices.retrieve(latestInvoiceId ?? incomingInvoice.id, { expand: ['payments.data.payment.payment_intent'] });
  const subRef = invoice.parent?.subscription_details?.subscription;
  const subscriptionId = typeof subRef === 'string' ? subRef : subRef?.id;
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const item = subscription.items.data.find(i => i.price.lookup_key === PROVIDER_MEMBERSHIP_PRICE);
  const others = subscription.items.data.filter(i => i !== item);
  if (!item || item.price.unit_amount !== MEMBERSHIP_PRICING.baseCents || item.price.currency !== 'usd' || item.price.recurring?.interval !== 'month' || item.price.recurring.interval_count !== 1) return;
  if (others.length > 1 || (others[0] && (others[0].price.lookup_key !== NETWORK_ADDON_PRICE || others[0].price.unit_amount !== MEMBERSHIP_PRICING.networkCents))) return;
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: existing, error: readError } = await supabaseAdmin.from('subscriptions').select('id,user_id,workspace_id,membership_paid_at').eq('stripe_subscription_id', subscriptionId).eq('environment', env).maybeSingle();
  if (readError) throw new Error('Membership evidence read failed.');
  if (!existing) throw new Error('Awaiting authoritative subscription delivery.');
  const claimedWorkspace = existing.workspace_id || subscription.metadata.workspaceId;
  if (!claimedWorkspace) return; // Legacy person-only membership is not company entitlement.
  const { data: member } = await supabaseAdmin.from('workspace_members').select('role,is_contractor,workspaces!inner(account_type,status,is_test_account)').eq('user_id', existing.user_id).eq('workspace_id', claimedWorkspace).is('removed_at', null).maybeSingle();
  if (!member || member.role !== 'owner' || member.is_contractor || member.workspaces.account_type !== 'provider' || member.workspaces.is_test_account) return;
  const paidAt = invoice.status_transitions.paid_at;
  if (paidAt && existing.membership_paid_at && paidAt * 1000 < Date.parse(existing.membership_paid_at)) return;
  let refunded = false;
  let confirmedCharge = false;
  for (const payment of invoice.payments?.data ?? []) {
    const ref = payment.payment.payment_intent;
    const intent = typeof ref === 'string' ? await stripe.paymentIntents.retrieve(ref) : ref;
    if (!intent || intent.status !== 'succeeded' || !intent.latest_charge) continue;
    const charge = typeof intent.latest_charge === 'string' ? await stripe.charges.retrieve(intent.latest_charge) : intent.latest_charge;
    confirmedCharge = true;
    if (charge.refunded || charge.amount_refunded > 0 || charge.disputed) refunded = true;
  }
  const qualifies = confirmedCharge && !refunded && isQualifyingMembershipInvoice(invoice, { status: subscription.status, trial_end: subscription.trial_end, current_period_end: item.current_period_end }, Date.now() / 1000);
  const { error } = await supabaseAdmin.from('subscriptions').update({ workspace_id: claimedWorkspace, membership_invoice_id: invoice.id, membership_paid_cents: invoice.amount_paid, membership_currency: invoice.currency, membership_payment_state: refunded ? 'refunded' : qualifies ? 'succeeded' : invoice.status === 'paid' ? 'pending' : 'failed', membership_paid_at: paidAt ? new Date(paidAt * 1000).toISOString() : null, status: subscription.status, current_period_end: new Date(item.current_period_end * 1000).toISOString() }).eq('id', existing.id).eq('environment', env);
  if (error) throw new Error('Membership evidence could not be saved.');
}

export async function reconcileMembershipCharge(object: any, env: StripeEnv) {
  if (env !== 'live') return;
  const stripe = createStripeClient(env);
  const chargeRef = object?.charge ?? object?.id;
  if (typeof chargeRef !== 'string') return;
  const charge = await stripe.charges.retrieve(chargeRef);
  const intentRef = charge.payment_intent;
  const intentId = typeof intentRef === 'string' ? intentRef : intentRef?.id;
  if (!intentId) return;
  const invoices = await stripe.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: intentId }, limit: 100 });
  for (const payment of invoices.data) {
    const invoiceId = typeof payment.invoice === 'string' ? payment.invoice : payment.invoice.id;
    await reconcileMembershipInvoice({ id: invoiceId }, env);
  }
}

export async function reconcileLatestMembershipInvoice(subscriptionObject: any, env: StripeEnv) {
  if (env !== 'live' || !subscriptionObject?.id) return;
  const stripe = createStripeClient(env);
  const subscription = await stripe.subscriptions.retrieve(subscriptionObject.id);
  const latest = subscription.latest_invoice;
  if (latest) await reconcileMembershipInvoice({ id: typeof latest === 'string' ? latest : latest.id }, env);
}
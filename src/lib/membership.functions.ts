import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { type StripeEnv, createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';
import {
  BASE_MEMBERSHIP_PRICE, LEGACY_MEMBERSHIP_PRICE, NETWORK_ADDON_PRICE, MEMBERSHIP_PRICING,
  type AddonStatus, type BaseStatus,
} from '@/lib/membership-pricing';

export type MembershipSummary = {
  linked: boolean;
  legacy: boolean;
  base: BaseStatus;
  addon: AddonStatus;
  addonCancelAt: string | null;
  trialEnd: string | null;
  renewalAt: string | null;
  cancelAtPeriodEnd: boolean;
  items: { label: string; cents: number }[];
  totalCents: number;
  transition: { status: string; currentCents: number | null; proposedCents: number; renewalAt: string | null; reason: string | null; preparedAt: string } | null;
  needsReviewReason: string | null;
  environment: string | null;
  stripeLinked: boolean;
  semiVerifiedPayment: boolean;
};

const MEMBERSHIP_PRICES = [BASE_MEMBERSHIP_PRICE, LEGACY_MEMBERSHIP_PRICE];
const envInput = z.object({ environment: z.enum(['sandbox', 'live']), workspaceId: z.string().uuid() });

function mapBase(status: string | null | undefined): BaseStatus {
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due' || status === 'unpaid') return 'past_due';
  if (status === 'canceled' || status === 'incomplete_expired') return 'canceled';
  return 'needs_review';
}

/** Builds a safe summary from server-side records; never returns Stripe IDs. */
async function buildSummary(admin: any, workspaceId: string, environment: string | null): Promise<MembershipSummary & { _sub: any | null }> {
  let q = admin.from('subscriptions').select('*').eq('workspace_id', workspaceId).in('price_id', MEMBERSHIP_PRICES).order('created_at', { ascending: false }).limit(1);
  if (environment) q = q.eq('environment', environment);
  const { data: rows } = await q;
  const sub = rows?.[0] ?? null;
  const [{ data: trial }, { data: owner }] = await Promise.all([
    admin.from('provider_membership_trials').select('ends_at').eq('workspace_id', workspaceId).maybeSingle(),
    admin.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null).limit(1).maybeSingle(),
  ]);
  let needsReviewReason: string | null = null;
  if (!sub && owner?.user_id) {
    const { data: unlinked } = await admin.from('subscriptions').select('id').eq('user_id', owner.user_id).is('workspace_id', null).in('price_id', MEMBERSHIP_PRICES).in('status', ['active', 'trialing', 'past_due']).limit(1);
    if (unlinked?.length) needsReviewReason = 'A membership subscription exists for the owner but is not linked to this business. It will not be migrated automatically.';
  }
  const { data: transition } = sub
    ? await admin.from('provider_membership_transitions').select('status,current_cents,proposed_cents,renewal_at,reason,prepared_at').eq('subscription_row_id', sub.id).maybeSingle()
    : { data: null };
  const legacy = sub?.price_id === LEGACY_MEMBERSHIP_PRICE;
  let base: BaseStatus = sub ? mapBase(sub.status) : needsReviewReason ? 'needs_review' : 'none';
  if (legacy && transition?.status === 'pending' && (base === 'active' || base === 'trialing')) base = 'pending_transition';
  if (transition?.status === 'needs_review') { base = 'needs_review'; needsReviewReason = transition.reason; }
  const addon: AddonStatus = !sub ? 'not_selected' : legacy ? (base === 'canceled' ? 'canceled' : 'active') : (sub.network_addon_status as AddonStatus);
  const items: { label: string; cents: number }[] = [];
  if (sub && base !== 'canceled') {
    if (legacy) items.push({ label: 'Former Provider Membership (includes Network until renewal transition)', cents: 1000 });
    else {
      items.push({ label: 'Base Provider Membership', cents: MEMBERSHIP_PRICING.baseCents });
      if (['trialing', 'active', 'past_due'].includes(addon)) items.push({ label: 'Referral Network add-on', cents: MEMBERSHIP_PRICING.networkCents });
    }
  }
  return {
    _sub: sub,
    linked: !!sub, legacy, base, addon,
    addonCancelAt: sub?.network_addon_cancel_at ?? null,
    trialEnd: sub?.trial_end ?? trial?.ends_at ?? null,
    renewalAt: sub?.current_period_end ?? null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    items, totalCents: items.reduce((a, i) => a + i.cents, 0),
    transition: transition ? { status: transition.status, currentCents: transition.current_cents, proposedCents: transition.proposed_cents, renewalAt: transition.renewal_at, reason: transition.reason, preparedAt: transition.prepared_at } : null,
    needsReviewReason,
    environment: sub?.environment ?? null,
    stripeLinked: !!sub?.stripe_customer_id,
    semiVerifiedPayment: sub?.membership_payment_state === 'succeeded',
  };
}

async function authorizeWorkspace(context: any, workspaceId: string, ownerOnly: boolean) {
  const { data: role } = await context.supabase.rpc('workspace_role_of', { _ws: workspaceId, _uid: context.userId });
  if (ownerOnly ? role !== 'owner' : role !== 'owner' && role !== 'admin') throw new Error('Only the business owner can manage membership billing.');
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: ws } = await supabaseAdmin.from('workspaces').select('account_type,status').eq('id', workspaceId).maybeSingle();
  if (ws?.account_type !== 'provider') throw new Error('Provider business required.');
  return { admin: supabaseAdmin, role: role as string };
}

export type BillingHistoryRow = { number: string | null; status: string | null; amountCents: number; created: string | null; url: string | null };
export type MaskedCard = { brand: string | null; last4: string | null; expMonth: number | null; expYear: number | null };

export const getMembershipBilling = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => envInput.parse(i))
  .handler(async ({ data, context }): Promise<{ summary: MembershipSummary; invoices: BillingHistoryRow[] | null; card: MaskedCard | null; owner: boolean; stripeError?: string }> => {
    const { admin, role } = await authorizeWorkspace(context, data.workspaceId, false);
    const { _sub, ...summary } = await buildSummary(admin, data.workspaceId, data.environment);
    const owner = role === 'owner';
    if (!owner || !_sub?.stripe_customer_id || _sub.environment !== data.environment) return { summary, invoices: owner ? [] : null, card: null, owner };
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const [inv, sub] = await Promise.all([
        stripe.invoices.list({ customer: _sub.stripe_customer_id, subscription: _sub.stripe_subscription_id, limit: 12 }),
        stripe.subscriptions.retrieve(_sub.stripe_subscription_id, { expand: ['default_payment_method'] }),
      ]);
      const pm: any = sub.default_payment_method;
      return {
        summary, owner,
        invoices: inv.data.map(i => ({ number: i.number ?? null, status: i.status ?? null, amountCents: i.amount_paid || i.amount_due || 0, created: i.created ? new Date(i.created * 1000).toISOString() : null, url: i.hosted_invoice_url ?? null })),
        card: pm?.card ? { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year } : null,
      };
    } catch (e) {
      return { summary, owner, invoices: [], card: null, stripeError: getStripeErrorMessage(e) };
    }
  });

/** Adds or removes the add-on on the existing base subscription; never creates a second subscription or a new trial. */
export const setNetworkAddon = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => envInput.extend({ enabled: z.boolean() }).parse(i))
  .handler(async ({ data, context }): Promise<{ ok: true; status: AddonStatus; effectiveAt: string | null } | { error: string }> => {
    const { admin } = await authorizeWorkspace(context, data.workspaceId, true);
    const { _sub } = await buildSummary(admin, data.workspaceId, data.environment);
    if (!_sub) return { error: 'Start your Base Provider Membership first.' };
    if (_sub.price_id === LEGACY_MEMBERSHIP_PRICE) return { error: 'Your current membership already includes the Network until its renewal transition.' };
    if (!['active', 'trialing'].includes(_sub.status)) return { error: 'Your base membership must be active or trialing.' };
    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const sub = await stripe.subscriptions.retrieve(_sub.stripe_subscription_id);
      const existing = sub.items.data.find(i => i.price.lookup_key === NETWORK_ADDON_PRICE);
      if (data.enabled) {
        if (existing) return { error: 'The Referral Network add-on is already on your membership.' };
        const prices = await stripe.prices.list({ lookup_keys: [NETWORK_ADDON_PRICE], active: true });
        const price = prices.data[0];
        if (!price) return { error: 'The Referral Network add-on is not available yet.' };
        await stripe.subscriptionItems.create({ subscription: sub.id, price: price.id, quantity: 1, proration_behavior: sub.status === 'trialing' ? 'none' : 'create_prorations' });
        const status: AddonStatus = sub.status === 'trialing' ? 'trialing' : 'active';
        await admin.from('subscriptions').update({ network_addon_status: status, network_addon_cancel_at: null, updated_at: new Date().toISOString() }).eq('id', _sub.id);
        return { ok: true, status, effectiveAt: null };
      }
      if (!existing) return { error: 'The Referral Network add-on is not on your membership.' };
      // Removed without proration: no further add-on charges; paid access continues until the current period ends.
      await stripe.subscriptionItems.del(existing.id, { proration_behavior: 'none' });
      const periodEnd = existing.current_period_end ? new Date(existing.current_period_end * 1000).toISOString() : _sub.current_period_end;
      const status: AddonStatus = sub.status === 'trialing' ? 'canceled' : 'canceling';
      await admin.from('subscriptions').update({ network_addon_status: status, network_addon_cancel_at: status === 'canceling' ? periodEnd : null, updated_at: new Date().toISOString() }).eq('id', _sub.id);
      return { ok: true, status, effectiveAt: status === 'canceling' ? periodEnd : null };
    } catch (e) {
      return { error: getStripeErrorMessage(e) };
    }
  });

export const getNetworkEntitlement = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: ok } = await context.supabase.rpc('provider_network_entitled', { _ws: data.workspaceId });
    return { entitled: !!ok };
  });

/** Read-only admin view; Master Admin or scoped people-read admins only. */
export const getAdminWorkspaceMembership = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { requireAdminCan, getAdminWorkspaceScope } = await import('@/lib/admin-guard.server');
    await requireAdminCan(context, 'people', 'read');
    const scope = await getAdminWorkspaceScope(context);
    if (!scope.all && !scope.workspaceIds.includes(data.workspaceId)) throw new Error('Account not available in your scope.');
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { _sub, ...summary } = await buildSummary(supabaseAdmin, data.workspaceId, null);
    return { ...summary, latestPayment: _sub ? { state: _sub.membership_payment_state as string | null, paidAt: _sub.membership_paid_at as string | null, cents: _sub.membership_paid_cents as number | null } : null };
  });

export const listMembershipTransitions = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: master } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!master) throw new Error('Master Admin only.');
    const [{ data: rows }, { data: flag }] = await Promise.all([
      context.supabase.from('provider_membership_transitions').select('id,workspace_id,environment,current_cents,proposed_cents,renewal_at,status,reason,prepared_by_mfn_id,prepared_at,activated_by_mfn_id,activated_at,workspaces(display_name,mfn_id)').order('prepared_at', { ascending: false }),
      context.supabase.from('platform_launch_flags').select('enabled').eq('key', 'membership_renewal_transition').maybeSingle(),
    ]);
    return { rows: rows ?? [], enabled: !!flag?.enabled };
  });

export const prepareMembershipTransitions = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('prepare_membership_transitions');
    if (error) throw new Error(error.message);
    return { prepared: data as number };
  });

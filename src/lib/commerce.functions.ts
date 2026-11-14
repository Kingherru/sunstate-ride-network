import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';
import { BASE_MEMBERSHIP_PRICE, NETWORK_ADDON_PRICE, MEMBERSHIP_PRICING } from '@/lib/membership-pricing';
import { assertCheckoutConsent } from './payment-policy';
import { confirmationComplete, normalizeSelection } from '@/lib/commerce-rules';

/**
 * One checkout for the shared cart. Recurring membership items and one-time courses go into a single
 * Stripe subscription-mode session (Stripe bills one-time prices on the first invoice). Course-only carts
 * use payment mode. Nothing is granted here: access comes only from verified webhook evidence.
 */
export const createCommerceCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    base: z.boolean(), network: z.boolean(), contractor:z.boolean().default(false),
    policyConsent: z.object({accepted:z.boolean(),termsVersion:z.string(),refundVersion:z.string()}).optional(),
    courseIds: z.array(z.string().uuid()).max(20),
    confirm: z.object({ recurring: z.boolean(), oneTime: z.boolean(), terms: z.boolean() }),
    environment: z.enum(['sandbox', 'live']), returnUrl: z.string().url(), payNow: z.boolean().default(false),
  }).parse(input))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      if(data.contractor)return {error:'Independent Contractor Membership checkout is unavailable pending verified Stripe price mapping and lifecycle configuration. No payment or entitlement was created.'};
      assertCheckoutConsent(data.policyConsent);
      const { requireCheckoutPreparationEnabled, requireApprovedPurchaseTerms, recordCheckoutAcceptance } = await import('./checkout-policy.server');
      await requireCheckoutPreparationEnabled();
      // Product-specific eligibility and final fee disclosure are intentionally not configured.
      await requireApprovedPurchaseTerms();
      const { getRequest } = await import('@tanstack/react-start/server');
      if (new URL(data.returnUrl).origin !== new URL(getRequest().url).origin) throw new Error('Invalid checkout return address');
      const ids = [...new Set(data.courseIds)];
      const { data: courses, error } = ids.length
        ? await context.supabase.from('courses').select('id,slug,title,price_id,price_cents,product_kind').in('id', ids).eq('is_published', true)
        : { data: [], error: null };
      if (error || (courses?.length ?? 0) !== ids.length) throw new Error('A course is unavailable');
      const { data: owned, error: ownedError } = ids.length ? await context.supabase.from('course_enrollments').select('course_id').eq('user_id', context.userId).in('course_id', ids) : { data: [], error: null };
      if (ownedError) throw new Error('Could not verify existing purchases');
      if (owned?.length) throw new Error('You already own an item in this cart. Remove it before checkout.');

      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      let workspaceId: string | undefined;
      let baseActive = false;
      let grantTrial = false;
      if (data.base || data.network) {
        const { data: memberships, error: membershipError } = await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('user_id', context.userId).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null);
        if (membershipError) throw new Error('Could not verify business ownership');
        const owners = (memberships ?? []).filter(m => m.workspaces.account_type === 'provider' && m.workspaces.status === 'active' && !m.workspaces.is_test_account);
        if (owners.length !== 1) return { error: 'One active provider business is required for membership checkout.' };
        const owner = owners[0];
        if (!owner) throw new Error('Provider business required');
        workspaceId = owner.workspace_id;
        const [{ data: current, error: currentError }, { data: trial, error: trialError }, { data: unlinked, error: unlinkedError }] = await Promise.all([
          supabaseAdmin.from('subscriptions').select('id').eq('workspace_id', workspaceId).eq('environment', data.environment).in('status', ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused']).limit(1),
          supabaseAdmin.from('provider_membership_trials').select('workspace_id').eq('workspace_id', workspaceId).maybeSingle(),
          supabaseAdmin.from('subscriptions').select('id').eq('user_id', context.userId).is('workspace_id', null).eq('environment', data.environment).in('status', ['active', 'trialing', 'past_due', 'incomplete', 'unpaid', 'paused']).limit(1),
        ]);
        if (currentError || trialError || unlinkedError) throw new Error('Could not verify membership or trial eligibility');
        if (unlinked?.length) throw new Error('An existing membership needs business linkage. Manage it from Settings → Membership.');
        baseActive = !!current?.length;
        grantTrial = !trial && !data.payNow;
      }
      const sel = normalizeSelection({ base: data.base, network: data.network, courses: (courses ?? []).map(c => ({ ...c, price_cents: c.price_cents ?? 0 })) }, { ownedCourseIds: [], baseActive, addonActive: false });
      if (data.base && baseActive) return { error: 'This business already has a membership. Manage it from Settings → Membership.' };
      if (data.network && !data.base) return { error: baseActive ? 'Add the Referral Network from Settings → Membership so it joins your existing membership.' : 'The Referral Network add-on requires the Provider Base Membership.' };
      if (!confirmationComplete(sel, data.confirm)) return { error: 'Please confirm your selected items and accept the Terms.' };

      const stripe = createStripeClient(data.environment);
      const lineItems: { price: string; quantity: number }[] = [];
      const resolve = async (key: string, type: 'recurring' | 'one_time', cents: number, label: string) => {
        const price = (await stripe.prices.list({ lookup_keys: [key], active: true })).data[0];
        if (!price || price.type !== type || price.unit_amount !== cents || price.currency !== 'usd' || (type === 'recurring' && (price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1))) throw new Error(`${label} requires product setup`);
        lineItems.push({ price: price.id, quantity: 1 });
      };
      if (sel.base) await resolve(BASE_MEMBERSHIP_PRICE, 'recurring', MEMBERSHIP_PRICING.baseCents, 'Provider Base Membership');
      if (sel.network) await resolve(NETWORK_ADDON_PRICE, 'recurring', MEMBERSHIP_PRICING.networkCents, 'Referral Network Add-On');
      for (const c of sel.courses) {
        if (!c.price_id) throw new Error(`${c.title} requires product setup`);
        await resolve(c.price_id, 'one_time', c.price_cents, c.title);
      }
      if (!lineItems.length) return { error: 'Your cart is empty.' };

      const email = typeof context.claims.email === 'string' ? context.claims.email : undefined;
      const { resolveOrCreateCustomer } = await import('@/lib/training/customer.server');
      const customer = await resolveOrCreateCustomer(stripe, { email, userId: context.userId });
      const metadata: Record<string, string> = { userId: context.userId };
      if (workspaceId) metadata.workspaceId = workspaceId;
      if (sel.courses.length) metadata.course_slugs = JSON.stringify(sel.courses.map(c => c.slug));
      const recurring = sel.base;
      if (recurring && !workspaceId) throw new Error('Provider business required');
      const params: Parameters<typeof stripe.checkout.sessions.create>[0] & { managed_payments: { enabled: boolean } } = {
        mode: recurring ? 'subscription' : 'payment', ui_mode: 'embedded_page', customer, line_items: lineItems,
        return_url: data.returnUrl, metadata,
        ...(recurring
          ? { subscription_data: { metadata: { userId: context.userId, ...(workspaceId && { workspaceId }) }, ...(grantTrial && { trial_period_days: MEMBERSHIP_PRICING.trialDays }) } }
          : { payment_intent_data: { description: sel.courses.map(c => c.title).join(' · ') } }),
        managed_payments: { enabled: true },
      };
      const acceptance = await recordCheckoutAcceptance(data.policyConsent, {personId:context.userId,workspaceId:workspaceId??null,referenceType:'combined_cart',referenceId:crypto.randomUUID(),amountCents:(grantTrial?0:(sel.base?MEMBERSHIP_PRICING.baseCents:0)+(sel.network?MEMBERSHIP_PRICING.networkCents:0))+sel.courses.reduce((n,c)=>n+c.price_cents,0),payer:workspaceId??context.userId,merchant:'MY FLORIDA NEMT',recurring,fees:[],checkoutKey:crypto.randomUUID(),attribution:new URL(getRequest().url).pathname});
      params.metadata={...metadata,policy_acceptance_id:acceptance.id};
      const session = await stripe.checkout.sessions.create(params,{idempotencyKey:`checkout:${acceptance.id}`});
      if (!session.client_secret) throw new Error('Stripe did not return checkout information');
      return { clientSecret: session.client_secret };
    } catch (e) { return { error: getStripeErrorMessage(e) }; }
  });

/** Read-only confirmation: a URL never proves payment or grants verification. */
export const getCommerceCheckoutStatus = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]+$/), environment: z.enum(['sandbox', 'live']) }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const session = await createStripeClient(data.environment).checkout.sessions.retrieve(data.sessionId);
      if (session.metadata?.userId !== context.userId) throw new Error('Checkout not found for your account');
      const paid = session.status === 'complete' && session.payment_status === 'paid';
      const complete = session.status === 'complete';
      const workspaceId = session.metadata.workspaceId;
      let membershipSynced = false;
      if (workspaceId && session.subscription) {
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
        const { data: row, error } = await context.supabase.from('subscriptions').select('id').eq('user_id', context.userId).eq('workspace_id', workspaceId).eq('environment', data.environment).eq('stripe_subscription_id', subscriptionId).maybeSingle();
        if (error) throw new Error('Membership confirmation is not available yet');
        membershipSynced = !!row;
      }
      return { paid, complete, membership: !!workspaceId, membershipSynced, training: !!(session.metadata.course_slugs || session.metadata.course_slug), testMode: data.environment === 'sandbox' };
    } catch (error) { return { error: getStripeErrorMessage(error) }; }
  });

/** Master Admin only (RLS): private grandfathering eligibility; never public. */
export const listGrandfathering = createServerFn({ method: 'GET' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: master } = await context.supabase.rpc('has_role', { _user_id: context.userId, _role: 'admin' });
    if (!master) throw new Error('Master Admin only.');
    const { data } = await context.supabase.from('provider_membership_grandfathering').select('id,workspace_id,environment,original_cents,eligible,effective_at,expires_at,status,prepared_at').order('prepared_at', { ascending: false });
    return { rows: data ?? [] };
  });

/** Records eligibility only. No effective date is set and no subscription is changed. */
export const prepareGrandfathering = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc('prepare_membership_grandfathering');
    if (error) throw new Error(error.message);
    return { prepared: data as number };
  });

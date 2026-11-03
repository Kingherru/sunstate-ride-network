import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';
import { BASE_MEMBERSHIP_PRICE, NETWORK_ADDON_PRICE, MEMBERSHIP_PRICING } from '@/lib/membership-pricing';
import { confirmationComplete, normalizeSelection } from '@/lib/commerce-rules';

/**
 * One checkout for the shared cart. Recurring membership items and one-time courses go into a single
 * Stripe subscription-mode session (Stripe bills one-time prices on the first invoice). Course-only carts
 * use payment mode. Nothing is granted here: access comes only from verified webhook evidence.
 */
export const createCommerceCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    base: z.boolean(), network: z.boolean(),
    courseIds: z.array(z.string().uuid()).max(20),
    confirm: z.object({ recurring: z.boolean(), oneTime: z.boolean(), terms: z.boolean() }),
    environment: z.enum(['sandbox', 'live']), returnUrl: z.string().url(),
  }).parse(input))
  .handler(async ({ data, context }): Promise<{ clientSecret: string } | { error: string }> => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      if (new URL(data.returnUrl).origin !== new URL(getRequest().url).origin) throw new Error('Invalid checkout return address');
      const ids = [...new Set(data.courseIds)];
      const { data: courses, error } = ids.length
        ? await context.supabase.from('courses').select('id,slug,title,price_id,price_cents').in('id', ids).eq('is_published', true)
        : { data: [], error: null };
      if (error || (courses?.length ?? 0) !== ids.length) throw new Error('A course is unavailable');
      const { data: owned } = ids.length ? await context.supabase.from('course_enrollments').select('course_id').eq('user_id', context.userId).in('course_id', ids) : { data: [] };
      if (owned?.length) throw new Error('You already own an item in this cart. Remove it before checkout.');

      const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
      let workspaceId: string | undefined;
      let baseActive = false;
      let grantTrial = false;
      if (data.base || data.network) {
        const { data: memberships } = await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('user_id', context.userId).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null);
        const owners = (memberships ?? []).filter(m => m.workspaces.account_type === 'provider' && m.workspaces.status === 'active' && !m.workspaces.is_test_account);
        if (owners.length !== 1) return { error: 'One active provider business is required for membership checkout.' };
        workspaceId = owners[0]!.workspace_id;
        const [{ data: current }, { data: trial }] = await Promise.all([
          supabaseAdmin.from('subscriptions').select('id').eq('workspace_id', workspaceId).in('status', ['active', 'trialing', 'past_due', 'incomplete']).limit(1),
          supabaseAdmin.from('provider_membership_trials').select('workspace_id').eq('workspace_id', workspaceId).maybeSingle(),
        ]);
        baseActive = !!current?.length;
        grantTrial = !trial;
      }
      const sel = normalizeSelection({ base: data.base, network: data.network, courses: (courses ?? []).map(c => ({ ...c, price_cents: c.price_cents ?? 0 })) }, { ownedCourseIds: [], baseActive, addonActive: false });
      if (data.base && baseActive) return { error: 'This business already has a membership. Manage it from Settings → Membership.' };
      if (data.network && !data.base) return { error: baseActive ? 'Add the Referral Network from Settings → Membership so it joins your existing membership.' : 'The Referral Network add-on requires the Provider Base Membership.' };
      if (!confirmationComplete(sel, data.confirm)) return { error: 'Please confirm your selected items and accept the Terms.' };

      const stripe = createStripeClient(data.environment);
      const lineItems: { price: string; quantity: number }[] = [];
      const resolve = async (key: string, type: 'recurring' | 'one_time', cents: number, label: string) => {
        const price = (await stripe.prices.list({ lookup_keys: [key], active: true })).data[0];
        if (!price || price.type !== type || price.unit_amount !== cents || price.currency !== 'usd') throw new Error(`${label} requires product setup`);
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
      const session = await stripe.checkout.sessions.create({
        mode: recurring ? 'subscription' : 'payment', ui_mode: 'embedded_page', customer, line_items: lineItems,
        return_url: data.returnUrl, metadata,
        ...(recurring
          ? { subscription_data: { metadata: { userId: context.userId, workspaceId: workspaceId! }, ...(grantTrial && { trial_period_days: MEMBERSHIP_PRICING.trialDays }) } }
          : { payment_intent_data: { description: sel.courses.map(c => c.title).join(' · ') } }),
        managed_payments: { enabled: true },
      } as any);
      if (!session.client_secret) throw new Error('Stripe did not return checkout information');
      return { clientSecret: session.client_secret };
    } catch (e) { return { error: getStripeErrorMessage(e) }; }
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

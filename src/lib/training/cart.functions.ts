import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { createStripeClient, getStripeErrorMessage } from '@/lib/stripe.server';

// A dedicated course checkout: membership checkout remains unchanged.
export const createTrainingCheckout = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ courseIds: z.array(z.string().uuid()).min(1).max(20), environment: z.enum(['sandbox', 'live']), returnUrl: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { getRequest } = await import('@tanstack/react-start/server');
      const origin = new URL(getRequest().url).origin;
      if (new URL(data.returnUrl).origin !== origin) throw new Error('Invalid checkout return address');
      const ids = [...new Set(data.courseIds)];
      const { data: courses, error } = await context.supabase.from('courses').select('id,slug,title,price_id').in('id', ids).eq('is_published', true);
      if (error || courses?.length !== ids.length) throw new Error('A course is unavailable');
      const { data: owned, error: ownedError } = await context.supabase.from('course_enrollments').select('course_id').eq('user_id', context.userId).in('course_id', ids);
      if (ownedError) throw new Error('Could not verify existing purchases');
      if (owned?.length) throw new Error('You already own an item in this cart. Remove it before checkout.');
      const stripe = createStripeClient(data.environment);
      const lineItems = [];
      for (const course of courses) {
        if (!course.price_id) throw new Error(`${course.title} requires product setup`);
        const prices = await stripe.prices.list({ lookup_keys: [course.price_id], active: true });
        const price = prices.data[0];
        if (!price || price.type !== 'one_time') throw new Error(`${course.title} requires product setup`);
        lineItems.push({ price: price.id, quantity: 1 });
      }
      const email = typeof context.claims.email === 'string' ? context.claims.email : undefined;
      // Resolve a searchable user-linked customer using the shared checkout pattern.
      const found = await stripe.customers.search({ query: `metadata['userId']:'${context.userId}'`, limit: 1 });
      let customerId = found.data[0]?.id;
      if (!customerId && email) {
        const existing = await stripe.customers.list({ email, limit: 1 });
        const customer = existing.data[0];
        if (customer) {
          await stripe.customers.update(customer.id, { metadata: { ...customer.metadata, userId: context.userId } });
          customerId = customer.id;
        }
      }
      if (!customerId) customerId = (await stripe.customers.create({ ...(email ? { email } : {}), metadata: { userId: context.userId } })).id;
      const session = await stripe.checkout.sessions.create({
        mode: 'payment', ui_mode: 'embedded_page', customer: customerId, line_items: lineItems,
        return_url: data.returnUrl,
        metadata: { userId: context.userId, course_slugs: JSON.stringify(courses.map(c => c.slug)) },
        payment_intent_data: { description: courses.map(c => c.title).join(' · ') },
        managed_payments: { enabled: true },
      });
      if (!session.client_secret) throw new Error('Stripe did not return checkout information');
      return { clientSecret: session.client_secret };
    } catch (error) { return { error: getStripeErrorMessage(error) }; }
  });
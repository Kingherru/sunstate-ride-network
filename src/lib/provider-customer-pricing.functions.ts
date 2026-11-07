import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { customerPricingInput, customerQuoteInput } from './provider-customer-pricing';
const workspaceInput = z.object({ workspaceId: z.string().uuid() }).strict();
export const getCustomerPricing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => workspaceInput.parse(input))
  .handler(async ({ data, context }) => {
    const { readCustomerPricing } = await import('./provider-customer-pricing.server');
    return readCustomerPricing(context.supabase, data.workspaceId);
  });
export const saveCustomerPricing = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => customerPricingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc('save_provider_customer_pricing', { _workspace: data.workspaceId, _rates: data.rates, _expected_version: data.expectedVersion, _confirmed: data.confirmed });
    if (error) throw new Error('Rates could not be saved. Reload to check current rates and your account access.');
    return { ok: true };
  });
/** Future New Trip funding must call this server-authoritative calculation, then persist its returned snapshot. Never use it to replace an existing invoice. */
export const calculateProviderCustomerQuote = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid(), trip: customerQuoteInput }).strict().parse(input))
  .handler(async ({ data, context }) => {
    const { quoteNewProviderCustomerTrip } = await import('./provider-customer-pricing.server');
    return quoteNewProviderCustomerTrip(context.supabase, data.workspaceId, data.trip);
  });
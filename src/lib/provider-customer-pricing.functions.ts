import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { customerPricingInput, customerQuoteInput, customerRateBook, calculateCustomerQuote } from './provider-customer-pricing';
const workspaceInput = z.object({ workspaceId: z.string().uuid() }).strict();
/** Unsaved estimate only; uses the same validated formula as immutable new-trip quotes. */
export const previewCustomerPricing = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((i:unknown)=>workspaceInput.extend({rates:customerRateBook,trip:customerQuoteInput}).strict().parse(i))
  .handler(async({data,context})=>{const {data:allowed}=await context.supabase.rpc('can_manage_provider_customer_pricing',{_workspace:data.workspaceId});if(!allowed)throw new Error('Customer pricing unavailable.');return calculateCustomerQuote(data.rates,data.trip);});
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
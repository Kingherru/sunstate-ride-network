import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { customerRateBook, customerRatesFromLegacy, calculateCustomerQuote, type CustomerQuoteInput } from './provider-customer-pricing';
import {applicableRate} from './payer-rate-selection';

export async function readCustomerPricing(client: SupabaseClient<Database>, workspaceId: string) {
  const { data: allowed, error: permissionError } = await client.rpc('can_manage_provider_customer_pricing', { _workspace: workspaceId });
  if (permissionError || !allowed) throw new Error('Customer pricing is available to active provider owners and account admins, not contractors.');
  const { data: versions, error } = await client.from('provider_customer_pricing_versions').select('id,version,effective_at,person_mfn_id,workspace_mfn_id,rates').eq('workspace_id', workspaceId).is('payer_id',null).lte('effective_at', new Date().toISOString()).order('version', { ascending: false });
  if (error) throw new Error('Customer pricing unavailable');
  const { data: owners, error: ownerError } = await client.from('workspace_members').select('user_id').eq('workspace_id', workspaceId).eq('role', 'owner').eq('is_contractor', false).is('removed_at', null).order('created_at').limit(1);
  if (ownerError) throw new Error('Business pricing ownership unavailable');
  const owner = owners?.[0];
  const legacyResult = owner ? await client.from('provider_pricing').select('*').eq('owner_id', owner.user_id).maybeSingle() : { data: null, error: null };
  // Some legacy RLS only permits the person-owner. Never substitute an admin's unrelated rates.
  const legacy = legacyResult.error ? null : legacyResult.data;
  const latest = versions?.[0];
  const {data:allVersions}=await client.from('provider_customer_pricing_versions').select('version').eq('workspace_id',workspaceId).order('version',{ascending:false}).limit(1);
  return { rates: latest ? customerRateBook.parse(latest.rates) : customerRatesFromLegacy(legacy), version: allVersions?.[0]?.version ?? 0, effectiveAt: latest?.effective_at ?? null, legacyUnavailable: !latest && !legacy, history: (versions ?? []).map(v => ({ ...v, rates: customerRateBook.parse(v.rates) })) };
}

/** Only for a NEW quote/draft created now. Its caller must retain the snapshot for every later trip/invoice operation. */
export async function quoteNewProviderCustomerTrip(client: SupabaseClient<Database>, workspaceId: string, trip: CustomerQuoteInput,payerId?:string|null) {
  const current = await readCustomerPricing(client, workspaceId);
  const {data:versions,error}=await client.from('provider_customer_pricing_versions').select('id,version,effective_at,effective_end,agreement_active,payer_id,rates').eq('workspace_id',workspaceId).order('version',{ascending:false});if(error)throw new Error('Pricing setup required.');
  if(payerId){const {data:payer}=await client.from('payers').select('id').eq('workspace_id',workspaceId).eq('id',payerId).eq('active',true).maybeSingle();if(!payer)throw new Error('Authorized workspace payer required.');}
  const selected=(payerId?applicableRate(versions??[],payerId,trip.pickupDate):null)??applicableRate(versions??[],null,trip.pickupDate);
  if(!selected)throw new Error('Pricing setup required for this trip date.');const rates=customerRateBook.parse(selected.rates);
  return { ...calculateCustomerQuote(rates, trip), pricingSnapshot: { workspaceId,payerId:payerId??null, rateVersionId: selected.id, version: selected.version, effectiveAt: selected.effective_at, rates: structuredClone(rates) }, quotedAt: new Date().toISOString() };
}
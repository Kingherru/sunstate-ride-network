import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {assertCheckoutConsent,TERMS_VERSION,PAYMENT_POLICY_VERSION} from './payment-policy';
/** Persists a server-priced version only; never funds or sends an offer. */
export const prepareReferralFundingVersion=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((v:unknown)=>z.object({distributionId:z.string().uuid(),environment:z.enum(['sandbox','live']),policyConsent:z.object({accepted:z.boolean(),termsVersion:z.string(),refundVersion:z.string()}),confirmed:z.literal(true)}).strict().parse(v))
 .handler(async({data,context})=>{
 assertCheckoutConsent(data.policyConsent);
 const {data:allowed}=await context.supabase.rpc('network_source_access',{_id:data.distributionId,_manage:true});
 if(!allowed)throw new Error('Funding unavailable.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','referral_funding_version_preparation').maybeSingle();
 if(gate?.enabled!==true)return {error:'Funding-version preparation is off. No acceptance, funding or offer was saved.'};
 const {data:version,error}=await context.supabase.rpc('prepare_referral_funding_version',{_distribution:data.distributionId,_env:data.environment,_terms:TERMS_VERSION,_refund:PAYMENT_POLICY_VERSION});
 if(error)throw new Error('Funding version unavailable.');
 return {version};
 });
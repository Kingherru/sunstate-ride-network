import {supabaseAdmin} from '@/integrations/supabase/client.server';
import {allocateReversalResponsibility,type ReversalEvidence} from './refund-responsibility';
/** Internal server-only cause review. No client endpoint, processor calls or automatic charges. */
export async function appendAuthoritativeReversalReview(input:{actorId:string;acceptanceId:string;tripPaymentId:string;evidence:ReversalEvidence;reason:string}) {
 const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','refund_cause_review_writes').maybeSingle();
 if(gate?.enabled!==true)throw new Error('Refund cause review preparation is off.');
 const {data:master}=await supabaseAdmin.rpc('has_role',{_user_id:input.actorId,_role:'admin'});
 if(!master)throw new Error('Master Admin required.');
 const {data:payment}=await supabaseAdmin.from('trip_payments').select('id,amount_cents,amount_refunded_cents,stripe_charge_id,stripe_connected_account_id,policy_acceptance_id,charge_type').eq('id',input.tripPaymentId).maybeSingle();
 const {data:acceptance}=await supabaseAdmin.from('checkout_policy_acceptances').select('id,terms_version,refund_version').eq('id',input.acceptanceId).maybeSingle();
 if(!payment||!acceptance||payment.policy_acceptance_id!==acceptance.id||!payment.stripe_charge_id||payment.stripe_charge_id!==input.evidence.originalChargeRef||payment.charge_type!==input.evidence.chargeType||input.evidence.remainingPrincipalCents!==payment.amount_cents-payment.amount_refunded_cents)throw new Error('Authoritative payment / acceptance evidence required.');
 const allocation=allocateReversalResponsibility({...input.evidence,acceptanceId:acceptance.id,policyVersion:acceptance.refund_version,originalPaymentRef:payment.id});
 const {error}=await supabaseAdmin.from('fin_admin_actions').insert({admin_user_id:input.actorId,action:'refund_reversal_cause_review',amount_cents:allocation.principalCents,reason:input.reason,policy_acceptance_id:acceptance.id,responsibility_evidence:allocation,metadata:{idempotencyKey:allocation.idempotencyKey,execution:false}});
 if(error)throw new Error('Review could not be retained.');
 return allocation;
}
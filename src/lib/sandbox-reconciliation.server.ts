import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { PAYMENT_PURPOSES, evidenceMismatch, type Obligation, type PaymentEvidence } from './financial-preparation-rules';

/** OFF-gated signed-event inspection; never calls Stripe or grants access/funding. */
export async function prepareSandboxReconciliation(event:{id?:string;type:string;livemode?:boolean;account?:string;created?:number;data:{object:any}},source:'platform'|'connect') {
  const {data:gate,error:gateError}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','pass4m_sandbox_reconciliation').maybeSingle();
  if(gateError||gate?.enabled!==true)return {disabled:true};
  if(!event.id||event.livemode!==false)return {rejected:true,code:'environment_mismatch'};
  const object=event.data.object,meta=object?.metadata??{};
  const purpose=PAYMENT_PURPOSES.find(p=>p===meta.payment_purpose);
  let outcome:'pending_policy_review'|'rejected'|'unrelated'|'not_configured'='unrelated',reason='no_server_obligation';
  let expected:Obligation|null=null;
  if(purpose==='provider_customer_invoice'){
    const {data:payment,error}=await supabaseAdmin.from('trip_payments').select('id,invoice_document_id,stripe_payment_intent_id,stripe_connected_account_id,amount_cents,environment,policy_acceptance_id').eq('stripe_payment_intent_id',object.id).eq('environment','sandbox').maybeSingle();
    if(error)throw new Error('obligation_read_failed');
    if(payment?.invoice_document_id&&payment.stripe_payment_intent_id&&payment.policy_acceptance_id){
      const {data:invoice}=await supabaseAdmin.from('trip_invoice_documents').select('provider_workspace_id').eq('id',payment.invoice_document_id).maybeSingle();
      if(invoice)expected={purpose,environment:'sandbox',objectId:payment.stripe_payment_intent_id,objectType:'payment_intent',account:payment.stripe_connected_account_id,workspaceId:invoice.provider_workspace_id,referenceId:payment.invoice_document_id,amountCents:payment.amount_cents??0,currency:'usd',acceptanceId:payment.policy_acceptance_id};
    }
  }
  // Other purposes need their exact stored creation contract before authoritative application.
  if(purpose&&!expected){outcome='not_configured';reason='purpose_creation_binding_required';}
  if(expected){
    const actual:PaymentEvidence={purpose:purpose??expected.purpose,environment:'sandbox',objectId:object.id,objectType:object.object,account:event.account??null,workspaceId:meta.workspace_id??'',referenceId:meta.obligation_id??'',amountCents:object.amount_received??object.amount,currency:object.currency,acceptanceId:meta.policy_acceptance_id??'',livemode:false,eventId:event.id,eventCreated:event.created??0};
    const mismatch=evidenceMismatch(expected,actual);outcome=mismatch?'rejected':'pending_policy_review';reason=mismatch??'pass4l_required';
  }
  const evidence={environment:'sandbox',livemode:false,purpose:purpose??null,objectId:typeof object?.id==='string'?object.id:null,objectType:object?.object??null,connectedAccount:event.account??null,referenceId:expected?.referenceId??null,workspaceId:expected?.workspaceId??null,expectedCents:expected?.amountCents??null,authoritativeCents:Number.isSafeInteger(object?.amount_received??object?.amount)?object.amount_received??object.amount:null,currency:object?.currency??null,eventCreated:event.created??null,outcome,reason,auditVersion:'2026-11-08.4m'};
  const {data:claimed,error}=await supabaseAdmin.rpc('pass4m_claim_sandbox_event',{_id:event.id,_type:event.type,_source:source,_evidence:evidence});
  if(error)throw new Error('event_claim_failed');
  if(!claimed)return {duplicate:true};
  const {error:finishError}=await supabaseAdmin.rpc('pass4m_finish_sandbox_event',{_id:event.id,_outcome:outcome,_reason:reason});
  if(finishError)throw new Error('event_finish_failed');
  return {outcome,reason};
}
import {supabaseAdmin} from '@/integrations/supabase/client.server';
import {createStripeClient,type StripeEnv} from './stripe.server';
import {invoiceEvidenceMatches} from './customer-payment-evidence';
/** Called only by a signature-verified event dispatcher. No checkout, capture, refund or transfer. */
export async function reconcileCustomerInvoiceIntent(event:{id:string;account:string;intentId:string},environment:StripeEnv){
 const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','customer_invoice_reconciliation').maybeSingle();
 if(gate?.enabled!==true)return {disabled:true};
 const {data:payment}=await supabaseAdmin.from('trip_payments').select('id,invoice_document_id,stripe_payment_intent_id,stripe_connected_account_id,amount_cents,environment,policy_acceptance_id').eq('stripe_payment_intent_id',event.intentId).eq('environment',environment).not('invoice_document_id','is',null).maybeSingle();
 if(!payment)return {unrelated:true};
 const stripe=createStripeClient(environment);const intent=await stripe.paymentIntents.retrieve(event.intentId,{}, {stripeAccount:event.account});
 if(!invoiceEvidenceMatches({expectedIntent:payment.stripe_payment_intent_id,intent:intent.id,expectedAccount:payment.stripe_connected_account_id,account:event.account,expectedAmount:payment.amount_cents??0,amount:intent.amount,currency:intent.currency,expectedEnvironment:payment.environment,environment,acceptanceId:payment.policy_acceptance_id})||intent.metadata.invoice_document_id!==payment.invoice_document_id||intent.metadata.invoice_payment_id!==payment.id)throw new Error('Invoice evidence mismatch');
 const status=intent.status==='succeeded'?'succeeded':intent.status==='canceled'?'canceled':intent.status==='requires_payment_method'?'failed':null;
 if(!status)return {pending:true};
 const {data:applied,error}=await supabaseAdmin.rpc('apply_verified_invoice_payment',{_payment:payment.id,_event:event.id,_intent:intent.id,_account:event.account,_env:environment,_amount:intent.amount,_currency:intent.currency,_status:status});
 if(error)throw new Error('Invoice reconciliation unavailable');return {applied};
}
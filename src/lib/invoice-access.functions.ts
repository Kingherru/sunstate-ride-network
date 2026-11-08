import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import { invoiceTokenBindingValid } from './communication-rules';

export const prepareInvoiceAccessLink=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((v:unknown)=>z.object({invoiceId:z.string().uuid(),confirmed:z.literal(true),scope:z.enum(['view','payment'])}).strict().parse(v))
 .handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('trip_invoice_access',{_invoice:data.invoiceId,_manage:true});
  if(!allowed)throw new Error('Invoice unavailable.');
  if(data.scope!=='view')return {error:'Payment link preparation remains unavailable.'};
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:flag}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','invoice_secure_link_preparation').maybeSingle();
  if(flag?.enabled!==true)return {error:'Secure invoice link preparation is off. Nothing was saved or sent.'};
  const {generateInvitationToken,hashInvitationToken}=await import('./account-connections-token.server');
  const {data:invoice}=await context.supabase.from('trip_invoice_documents').select('provider_workspace_id,patient_workspace_id,billed_workspace_id,quote_id').eq('id',data.invoiceId).maybeSingle();
  if(!invoice || !invoice.billed_workspace_id && !invoice.patient_workspace_id)return {error:'Authorized customer binding required.'};
  const environment=process.env['STRIPE_ENVIRONMENT'];
  if(environment!=='sandbox'&&environment!=='live')return {error:'Invoice environment is not configured.'};
  const token=generateInvitationToken();const expiresAt=new Date(Date.now()+24*3600000).toISOString();
  const {error}=await supabaseAdmin.from('trip_invoice_access_tokens').insert({invoice_id:data.invoiceId,token_hash:await hashInvitationToken(token),scope:'view',expires_at:expiresAt,created_by:context.userId,customer_workspace_id:invoice.billed_workspace_id??invoice.patient_workspace_id,provider_workspace_id:invoice.provider_workspace_id,invoice_version:invoice.quote_id,environment});
  if(error)throw new Error('Secure link unavailable.');
  await supabaseAdmin.from('trip_invoice_events').insert({invoice_id:data.invoiceId,action:'secure_link_prepared',actor_id:context.userId,details:{scope:data.scope,expiresAt}});
  return {fragment:token,expiresAt};
 });
/** Bearer view returns the invoice's own allowlisted evidence, not trip or provider financial records. */
export const readSecureInvoice=createServerFn({method:'POST'})
 .inputValidator((v:unknown)=>z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(v))
 .handler(async({data})=>{
  const {hashInvitationToken,constantTimeHashEqual}=await import('./account-connections-token.server');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const hash=await hashInvitationToken(data.token);
  const {data:access}=await supabaseAdmin.from('trip_invoice_access_tokens').select('id,invoice_id,token_hash,expires_at,revoked_at,scope,customer_workspace_id,provider_workspace_id,invoice_version,environment,first_view_at').eq('token_hash',hash).maybeSingle();
  if(!access||!constantTimeHashEqual(hash,access.token_hash)||access.revoked_at||Date.parse(access.expires_at)<=Date.now())return {error:'Invoice link unavailable or expired.'};
  const {data:invoice}=await supabaseAdmin.from('trip_invoice_documents').select('id,mfn_id,provider_snapshot,quote_snapshot,total_cents,status,due_at,provider_workspace_id,patient_workspace_id,billed_workspace_id,quote_id').eq('id',access.invoice_id).maybeSingle();
  const environment=process.env['STRIPE_ENVIRONMENT'];
  if(!invoice || !environment || !invoiceTokenBindingValid({scope:access.scope,environment:access.environment,customerWorkspaceId:access.customer_workspace_id,providerWorkspaceId:access.provider_workspace_id,invoiceVersion:access.invoice_version,revokedAt:access.revoked_at,expiresAt:access.expires_at},{customerWorkspaceId:invoice.billed_workspace_id??invoice.patient_workspace_id,providerWorkspaceId:invoice.provider_workspace_id,version:invoice.quote_id},environment,Date.now()))return {error:'Invoice link unavailable or expired.'};
  const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','invoice_view_tracking').maybeSingle();
  if(gate?.enabled===true){const {data:firstView}=await supabaseAdmin.from('trip_invoice_access_tokens').update({first_view_at:new Date().toISOString()}).eq('id',access.id).is('first_view_at',null).select('id');if(firstView?.length)await supabaseAdmin.from('trip_invoice_events').insert({invoice_id:invoice.id,action:'invoice_viewed',details:{tokenId:access.id}});}
  const provider=invoice.provider_snapshot as {name?:string};const quote=invoice.quote_snapshot as {lines?:{label:string;cents:number}[];terms?:string;version?:number};
  return {invoice:{number:invoice.mfn_id,provider:provider.name??'Provider',lines:quote.lines??[],providerPolicy:quote.terms??'',totalCents:invoice.total_cents,status:invoice.status,dueAt:invoice.due_at},paymentEnabled:false};
 });
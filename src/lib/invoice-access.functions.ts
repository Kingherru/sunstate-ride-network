import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';

export const prepareInvoiceAccessLink=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((v:unknown)=>z.object({invoiceId:z.string().uuid(),confirmed:z.literal(true),scope:z.enum(['view','payment'])}).strict().parse(v))
 .handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc('trip_invoice_access',{_invoice:data.invoiceId,_manage:true});
  if(!allowed)throw new Error('Invoice unavailable.');
  const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
  const {data:flag}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','invoice_secure_link_preparation').maybeSingle();
  if(flag?.enabled!==true)return {error:'Secure invoice link preparation is off. Nothing was saved or sent.'};
  const {generateInvitationToken,hashInvitationToken}=await import('./account-connections-token.server');
  const token=generateInvitationToken();const expiresAt=new Date(Date.now()+7*86400000).toISOString();
  const {error}=await supabaseAdmin.from('trip_invoice_access_tokens').insert({invoice_id:data.invoiceId,token_hash:await hashInvitationToken(token),scope:data.scope,expires_at:expiresAt,created_by:context.userId});
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
  const {data:access}=await supabaseAdmin.from('trip_invoice_access_tokens').select('id,invoice_id,token_hash,expires_at,revoked_at,scope').eq('token_hash',hash).maybeSingle();
  if(!access||!constantTimeHashEqual(hash,access.token_hash)||access.revoked_at||Date.parse(access.expires_at)<=Date.now())return {error:'Invoice link unavailable or expired.'};
  const {data:invoice}=await supabaseAdmin.from('trip_invoice_documents').select('id,mfn_id,provider_snapshot,quote_snapshot,total_cents,status,due_at').eq('id',access.invoice_id).maybeSingle();
  if(!invoice)return {error:'Invoice unavailable.'};
  const {data:gate}=await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','invoice_view_tracking').maybeSingle();
  if(gate?.enabled===true)await supabaseAdmin.from('trip_invoice_events').insert({invoice_id:invoice.id,action:'invoice_viewed',details:{tokenId:access.id}});
  const provider=invoice.provider_snapshot as {name?:string};const quote=invoice.quote_snapshot as {lines?:{label:string;cents:number}[];terms?:string;version?:number};
  return {invoice:{number:invoice.mfn_id,provider:provider.name??'Provider',lines:quote.lines??[],providerPolicy:quote.terms??'',totalCents:invoice.total_cents,status:invoice.status,dueAt:invoice.due_at},paymentEnabled:false};
 });
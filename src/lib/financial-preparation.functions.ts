import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { FINANCIAL_VERSION, reconstructCart, connectChecklist, type CatalogLine } from './financial-preparation-rules';
import { BASE_MEMBERSHIP_PRICE, NETWORK_ADDON_PRICE } from './membership-pricing';
import { TERMS_VERSION, PAYMENT_POLICY_VERSION } from './payment-policy';

/** No Stripe reads or writes, no acceptance/event inserts. Amounts and targets are reconstructed here. */
export const reviewFinancialCart = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({base:z.boolean(),network:z.boolean(),courseIds:z.array(z.string().uuid()).max(20),environment:z.literal('sandbox')}).strict().parse(v))
  .handler(async({data,context})=>{
    const {data:profile,error:profileError}=await context.supabase.from('user_profiles').select('status,is_test_account,deleted_at').eq('user_id',context.userId).maybeSingle();
    if(profileError || !profile || profile.status!=='active' || profile.is_test_account || profile.deleted_at) throw new Error('Active purchasing account required');
    let workspaceId:string|null=null,baseReserved=false,addonReserved=false,trialUsed=true;
    if(data.base||data.network){
      const {data:members,error}=await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('user_id',context.userId).in('role',['owner','admin']).eq('is_contractor',false).is('removed_at',null);
      const eligible=(members??[]).filter(m=>m.workspaces.account_type==='provider'&&m.workspaces.status==='active'&&!m.workspaces.is_test_account);
      if(error||eligible.length!==1||!eligible[0]) throw new Error('One authorized active Provider business required');
      workspaceId=eligible[0].workspace_id;
      const {data:allowed,error:permissionError}=await context.supabase.rpc('can_manage_provider_customer_pricing',{_workspace:workspaceId});
      if(permissionError||!allowed) throw new Error('Business permission required');
      const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
      const [{data:subs,error:subError},{data:trial,error:trialError}]=await Promise.all([
        supabaseAdmin.from('subscriptions').select('status,current_period_end,network_addon_status').eq('workspace_id',workspaceId).eq('environment','sandbox'),
        supabaseAdmin.from('provider_membership_trials').select('workspace_id').eq('workspace_id',workspaceId).maybeSingle(),
      ]);
      if(subError||trialError) throw new Error('Membership evidence unavailable');
      const reserved=(subs??[]).filter(s=>['active','trialing','past_due','unpaid','incomplete','paused'].includes(s.status)||s.status==='canceled'&&!!s.current_period_end&&Date.parse(s.current_period_end)>Date.now());
      baseReserved=reserved.length>0;addonReserved=reserved.some(s=>['active','trialing','canceling','past_due'].includes(s.network_addon_status));trialUsed=!!trial||reserved.length>0;
    }
    const ids=[...new Set(data.courseIds)];
    if(ids.length!==data.courseIds.length)throw new Error('Duplicate cart selection');
    const [{data:courses,error:courseError},{data:owned,error:ownedError}]=await Promise.all([
      ids.length?context.supabase.from('courses').select('id,title,price_id,price_cents,product_kind,commerce_catalog_version').in('id',ids).eq('is_published',true):Promise.resolve({data:[],error:null}),
      ids.length?context.supabase.from('course_enrollments').select('course_id').eq('user_id',context.userId).in('course_id',ids):Promise.resolve({data:[],error:null}),
    ]);
    if(courseError||ownedError||(courses?.length??0)!==ids.length)throw new Error('Catalog unavailable');
    const line=(productId:string,kind:CatalogLine['kind'],title:string,priceKey:string,unitCents:number,recurrence:'month'|null):CatalogLine=>({productId,kind,title,priceKey,unitCents,recurrence,stripeProductId:null,stripePriceId:null,quantity:1,currency:'usd',catalogVersion:FINANCIAL_VERSION,environment:'sandbox',termsVersion:TERMS_VERSION,refundVersion:PAYMENT_POLICY_VERSION});
    const catalog:CatalogLine[]=[line('provider_base','base','Provider Base Membership',BASE_MEMBERSHIP_PRICE,2000,'month'),line('network_addon','network_addon','Referral Network add-on',NETWORK_ADDON_PRICE,1000,'month'),...(courses??[]).map(c=>{
      if(!c.price_id||c.price_cents===null)throw new Error('Price configuration required');
      const kind:CatalogLine['kind']=c.product_kind==='digital_guide'?'digital_guide':c.product_kind==='test'?'test':'course';
      return line(c.id,kind,c.title,c.price_id,c.price_cents,null);
    })];
    const review=reconstructCart([...(data.base?['provider_base']:[]),...(data.network?['network_addon']:[]),...ids],catalog,'sandbox',{provider:!!workspaceId,baseReserved,addonReserved,owned:(owned??[]).map(o=>o.course_id),trialUsed});
    const binding={personId:context.userId,workspaceId,environment:'sandbox',review,termsVersion:TERMS_VERSION,refundVersion:PAYMENT_POLICY_VERSION,tax:'not_configured',processing:'not_configured'};
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(binding)));
    const cartHash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
    return {...review,cartHash,catalogVersion:FINANCIAL_VERSION,termsVersion:TERMS_VERSION,refundVersion:PAYMENT_POLICY_VERSION,checkoutAvailable:false as const,blockers:['Pass 4L purchase/refund and fee approval','Verified sandbox Stripe product/price mapping','Configured tax and processing treatment',...(review.trialDays&&review.oneTimeCents?['Authoritative trial plus one-time billing timing']:[])],policyAcceptanceRecorded:false as const};
  });

export const getWorkspaceConnectPreparation = createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
  .inputValidator((v:unknown)=>z.object({workspaceId:z.string().uuid(),environment:z.literal('sandbox')}).strict().parse(v))
  .handler(async({data,context})=>{
    const {data:allowed,error}=await context.supabase.rpc('can_manage_provider_customer_pricing',{_workspace:data.workspaceId});
    if(error||!allowed)throw new Error('Provider business permission required');
    const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
    const {data:rows,error:readError}=await supabaseAdmin.from('provider_payout_accounts').select('status,charges_enabled,payouts_enabled,details_submitted,requirements_due').eq('workspace_id',data.workspaceId).eq('environment','sandbox');
    if(readError||(rows?.length??0)>1)throw new Error('Connected account binding needs review');
    const a=rows?.[0];
    const checklist=connectChecklist(a?{charges:!!a.charges_enabled,payouts:!!a.payouts_enabled,details:!!a.details_submitted,dueCount:Array.isArray(a.requirements_due)?a.requirements_due.length:0,restricted:a.status==='restricted'}:null);
    return {...checklist,environment:'sandbox',activation:false as const,signingConfigured:!!process.env['STRIPE_CONNECT_SANDBOX_WEBHOOK_SECRET']};
  });

export const listFinancialReconciliation = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:master,error:permissionError}=await context.supabase.rpc('has_role',{_user_id:context.userId,_role:'admin'});
  if(permissionError||!master)throw new Error('Master Admin only');
  const {data,error}=await context.supabase.rpc('pass4m_list_reconciliation');
  if(error)throw new Error('Reconciliation history unavailable');
  return {rows:data??[],environment:'sandbox',activation:false as const};
});
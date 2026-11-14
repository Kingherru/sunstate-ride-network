import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
const scope = z.object({ workspaceId: z.string().uuid() }).strict();
const details = z.object({ display_name: z.string().trim().min(1).max(160), legal_business_name: z.string().trim().max(160), business_phone: z.string().trim().max(32), dispatch_phone: z.string().trim().max(32), business_address: z.string().trim().max(300), mailing_address: z.string().trim().max(300), operating_hours: z.string().trim().max(500) }).strict();
export const getBusinessSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => scope.parse(i)).handler(async ({ data, context }) => {
  const { data: allowed } = await context.supabase.rpc('can_manage_account_connections', { _ws: data.workspaceId });
  if (!allowed) throw new Error('Business settings unavailable.');
  const { data: workspace, error } = await context.supabase.from('workspaces').select('display_name,legal_business_name,business_phone,dispatch_phone,business_address,mailing_address,operating_hours,mfn_id,account_type').eq('id', data.workspaceId).single();
  if (error || !workspace || workspace.account_type === 'private_pay') throw new Error('Business settings unavailable.');
  const {data:owner}=await context.supabase.from('workspace_members').select('user_id').eq('workspace_id',data.workspaceId).eq('role','owner').eq('is_contractor',false).is('removed_at',null).maybeSingle();
  const {data:numbers}=owner?await context.supabase.from('member_profiles').select('npi,medicaid_number').eq('user_id',owner.user_id).maybeSingle():{data:null};
  return {...workspace,npi:numbers?.npi??'',medicaid_number:numbers?.medicaid_number??'',canEditProviderNumbers:owner?.user_id===context.userId};
});
export const saveProviderNumbers=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.extend({npi:z.string().regex(/^(?:\d{10})?$/),medicaid_number:z.string().trim().max(60)}).strict().parse(i)).handler(async({data,context})=>{
 const {data:m}=await context.supabase.from('workspace_members').select('workspace_id,workspaces!inner(account_type,status,is_test_account)').eq('workspace_id',data.workspaceId).eq('user_id',context.userId).eq('role','owner').eq('is_contractor',false).is('removed_at',null).maybeSingle();if(!m||m.workspaces.account_type!=='provider'||m.workspaces.status!=='active'||m.workspaces.is_test_account)throw new Error('Active provider owner required');
 const {error}=await context.supabase.from('member_profiles').upsert({user_id:context.userId,npi:data.npi||null,medicaid_number:data.medicaid_number||null},{onConflict:'user_id'});if(error)throw new Error('Provider numbers could not be saved');return {ok:true};
});
export const saveBusinessSettings = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).inputValidator((i: unknown) => scope.extend({ details }).strict().parse(i)).handler(async ({ data, context }) => {
  const { error } = await context.supabase.rpc('save_workspace_business_settings', { _ws: data.workspaceId, _details: data.details });
  if (error) throw new Error('Business settings could not be saved.');
  return { ok: true };
});
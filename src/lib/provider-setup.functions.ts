import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { providerSubtypeSchema, delaySchema } from './pass4p-rules';

export const getProviderSetup = createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({workspaceId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
  const {data:w,error}=await context.supabase.from('workspaces').select('id,account_type,status,is_test_account,provider_subtype,provider_service_roles,provider_subtype_selected_at,pickup_delay_minutes,provider_verified').eq('id',data.workspaceId).single();
  const {data:m}=await context.supabase.from('workspace_members').select('role,is_contractor').eq('workspace_id',data.workspaceId).eq('user_id',context.userId).is('removed_at',null).maybeSingle();
  if(error||!w||w.account_type!=='provider'||w.status!=='active'||w.is_test_account||!m||m.is_contractor||!['owner','admin'].includes(m.role))throw new Error('Active provider manager required');
  const {data:p}=await context.supabase.from('user_profiles').select('onboarding_completed_at').eq('user_id',context.userId).single();
  const {data:vehicles}=await context.supabase.from('vehicles').select('id,vehicle_category,evidence_status').eq('workspace_id',data.workspaceId);
  return {...w,isOwner:m.role==='owner',canSelect:m.role==='owner'&&!p?.onboarding_completed_at&&!w.provider_subtype_selected_at,vehicles:vehicles??[]};
});
export const selectProviderSubtype = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({workspaceId:z.string().uuid(),subtype:providerSubtypeSchema}).strict().parse(i)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('select_provider_subtype',{_ws:data.workspaceId,_subtype:data.subtype});if(error)throw new Error('Subtype selection is unavailable for established accounts or completed setup.');return {ok:true};
});
export const savePickupDelay = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({workspaceId:z.string().uuid(),minutes:delaySchema}).strict().parse(i)).handler(async({data,context})=>{
 const {data:m}=await context.supabase.from('workspace_members').select('role,is_contractor,workspaces!inner(status,account_type,is_test_account)').eq('user_id',context.userId).eq('workspace_id',data.workspaceId).is('removed_at',null).maybeSingle();
 if(!m||m.is_contractor||!['owner','admin'].includes(m.role)||m.workspaces.status!=='active'||m.workspaces.account_type!=='provider'||m.workspaces.is_test_account)throw new Error('Active provider manager required');
 const {error}=await context.supabase.from('workspaces').update({pickup_delay_minutes:data.minutes}).eq('id',data.workspaceId);if(error)throw new Error('Could not save pickup delay');return {ok:true};
});
import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const getFacilityBillingProviders=createServerFn({method:'POST'}).middleware([requireSupabaseAuth])
 .inputValidator((v:unknown)=>z.object({workspaceId:z.string().uuid()}).strict().parse(v))
 .handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('can_manage_account_connections',{_ws:data.workspaceId});
 const {data:workspace}=await context.supabase.from('workspaces').select('account_type,status,is_test_account').eq('id',data.workspaceId).maybeSingle();
 if(!allowed||!workspace||!['facility','hospital'].includes(workspace.account_type)||workspace.status!=='active'||workspace.is_test_account)throw new Error('Facility billing unavailable.');
 const {data:connections,error}=await context.supabase.from('account_business_connections').select('id,workspace_a,workspace_b').eq('active',true).or(`workspace_a.eq.${data.workspaceId},workspace_b.eq.${data.workspaceId}`);
 if(error)throw new Error('Connections unavailable.');
 const ids=(connections??[]).map(c=>c.workspace_a===data.workspaceId?c.workspace_b:c.workspace_a);
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:providers}=ids.length?await supabaseAdmin.from('workspaces').select('id,display_name,mfn_id').in('id',ids).eq('account_type','provider').eq('status','active').eq('is_test_account',false):{data:[]};
 const {data:agreements}=await context.supabase.from('provider_facility_agreement_versions').select('id,provider_workspace_id,version,quote_reference,approved_total_cents,bill_to_workspace_id,responsible_payer_workspace_id,provider_policy_snapshot').eq('facility_workspace_id',data.workspaceId).order('version',{ascending:false});
 return {providers:providers??[],agreements:agreements??[]};
 });
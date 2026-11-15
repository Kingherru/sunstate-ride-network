import {createServerFn} from '@tanstack/react-start';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
import {z} from 'zod';
export const getNetworkAccess=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:members,error}=await context.supabase.from('workspace_members').select('workspace_id,role,workspaces!inner(account_type,status,provider_subtype)').eq('user_id',context.userId).is('removed_at',null).eq('is_contractor',false);
 if(error)throw new Error('Network membership unavailable.');
 const providers=(members??[]).filter(m=>m.workspaces.account_type==='provider'&&m.workspaces.status==='active');
 if(providers.length!==1||!providers[0])return {entitled:false,workspaceId:null,contractor:false,canPurchase:false,baseActive:false};
 const m=providers[0];const {data:entitled,error:gateError}=await context.supabase.rpc('provider_network_entitled',{_ws:m.workspace_id});if(gateError)throw new Error('Network membership unavailable.');
 const {data:subs}=await context.supabase.from('subscriptions').select('status,current_period_end').eq('workspace_id',m.workspace_id).in('price_id',['nemt_provider_base_monthly','nemt_membership_monthly_v2']);
 const baseActive=(subs??[]).some(s=>['active','trialing'].includes(s.status)&&(!s.current_period_end||Date.parse(s.current_period_end)>Date.now()));
 return {entitled:entitled===true,workspaceId:m.workspace_id,contractor:m.workspaces.provider_subtype==='independent_contractor',canPurchase:['owner','admin'].includes(m.role),baseActive};
});
export const networkViews=['offers','activity','payments','settlements','patients','providers','contractors'] as const;
export const getNetworkActivityCounts=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const {data:marks}=await context.supabase.from('tab_view_marks').select('tab_key,last_viewed_at').eq('user_id',context.userId);
 const since=(key:string)=>marks?.find(m=>m.tab_key===`network:${key}`)?.last_viewed_at??'1970-01-01T00:00:00Z';
 const {data:offers,error:offerError}=await context.supabase.from('provider_trip_offers').select('updated_at,created_at');
 const {data:activity,error:activityError}=await context.supabase.rpc('network_list_activity');
 if(offerError||activityError)throw new Error('Network activity unavailable.');
 const offerRows=offers as unknown as {created_at?:string;updated_at?:string}[]|null;
 const activityRows=activity as unknown as {events?:{created_at:string}[];negotiations?:{created_at:string}[]}[]|null;
 const counts:Record<string,number>={offers:(offerRows??[]).filter(o=>(o.updated_at??o.created_at??'')>since('offers')).length,activity:(activityRows??[]).filter(a=>[...(a.events??[]),...(a.negotiations??[])].some(e=>e.created_at>since('activity'))).length};
 const sources=[['payments','network_settlements'],['settlements','network_settlements'],['contractors','account_business_connections']] as const;
 for(const [key,table]of sources){const {count,error}=await context.supabase.from(table).select('id',{count:'exact',head:true}).gt(key==='contractors'?'created_at':'updated_at',since(key));counts[key]=error?0:count??0;}
 const {data:patients}=await context.supabase.from('ride_requests').select('last_updated_at,created_at,selected_provider_workspace_id').not('selected_provider_workspace_id','is',null);counts.patients=(patients??[]).filter(r=>(r.last_updated_at??r.created_at)>since('patients')).length;
 const {data:providers}=await context.supabase.rpc('list_network_providers',{});counts.providers=(providers as unknown as {updated_at?:string}[]??[]).filter(r=>!!r.updated_at&&r.updated_at>since('providers')).length;
 return counts;
});
export const markNetworkViewRead=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({view:z.enum(networkViews)}).strict().parse(v)).handler(async({data,context})=>{
 const {error}=await context.supabase.from('tab_view_marks').upsert({user_id:context.userId,tab_key:`network:${data.view}`,last_viewed_at:new Date().toISOString()},{onConflict:'user_id,tab_key'});if(error)throw new Error('Could not mark Network activity read.');return {ok:true as const};
});
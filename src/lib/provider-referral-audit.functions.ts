import {createServerFn} from '@tanstack/react-start';
import {z} from 'zod';
import {requireSupabaseAuth} from '@/integrations/supabase/auth-middleware';
export const recordOwnedReferralFailure=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({workspaceId:z.string().uuid(),tripId:z.string().uuid()}).strict().parse(v)).handler(async({data,context})=>{
 const {data:can}=await context.supabase.rpc('can_manage_provider_customer_pricing',{_workspace:data.workspaceId});
 const {data:trip}=await context.supabase.from('trips').select('id,ride_request_id').eq('id',data.tripId).maybeSingle();
 if(!can||!trip)throw new Error('Referral audit unavailable.');
 const {data:request}=trip.ride_request_id?await context.supabase.from('ride_requests').select('workspace_id').eq('id',trip.ride_request_id).maybeSingle():{data:null};
 if(request?.workspace_id!==data.workspaceId)throw new Error('Referral audit unavailable.');
 const {data:person}=await context.supabase.from('user_profiles').select('mfn_id').eq('user_id',context.userId).maybeSingle();
 const {data:workspace}=await context.supabase.from('workspaces').select('mfn_id').eq('id',data.workspaceId).maybeSingle();
 if(!person?.mfn_id||!workspace?.mfn_id)throw new Error('Referral audit unavailable.');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {error}=await supabaseAdmin.from('account_security_audit').insert({user_id:context.userId,workspace_id:data.workspaceId,sender_mfn_id:person.mfn_id,workspace_mfn_id:workspace.mfn_id,event_type:'owned_referral_not_sent',result:'blocked',details:{tripId:data.tripId,reason:'controlled_referral_readiness_failed',retryDestination:'/portal/network'}});
 if(error)throw new Error('Trip retained; referral audit could not be recorded.');return {ok:true};
});
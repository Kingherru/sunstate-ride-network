import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { rideRequestSchema } from './request-schemas';
/** Reuses immutable series occurrence keys for single provider submission retries. */
export const submitProviderOwnedTrip=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>z.object({request:rideRequestSchema,operationId:z.string().uuid(),workspaceId:z.string().uuid()}).strict().parse(v)).handler(async({data,context})=>{
 const {data:can}=await context.supabase.rpc('can_manage_provider_customer_pricing',{_workspace:data.workspaceId});
 if(!can)throw new Error('Active provider owner or administrator required.');
 const svc=await import('./requests/request-service.server');const requester=await svc.resolveRequester();
 if(requester.userId!==context.userId||requester.workspaceId!==data.workspaceId)throw new Error('Creating workspace unavailable.');
 const read=()=>context.supabase.from('ride_requests').select('id,mfn_id,copy_fingerprint').eq('actor_user_id',context.userId).eq('workspace_id',data.workspaceId).eq('series_id',data.operationId).eq('series_index',0).maybeSingle();
 const {data:prior,error}=await read();if(error)throw new Error('Could not check submission retry.');
 const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data.request))))).map(b=>b.toString(16).padStart(2,'0')).join('');
 if(prior && prior.copy_fingerprint!==fingerprint)throw new Error('Trip already saved. Start a new trip rather than altering a submission retry.');
 let id=prior?.id,mfnId=prior?.mfn_id;
 if(!id){const r=await svc.insertPassengerRequest(data.request,{requesterUserId:context.userId,actorUserId:context.userId,workspaceId:data.workspaceId,submittedVia:'portal',skipNotify:true,series:{id:data.operationId,index:0,fingerprint,evidence:{intent:'provider_owned_single',count:1}}});if(r.ok){id=r.id;mfnId=r.mfnId;}else{const {data:retry}=await read();id=retry?.id;mfnId=retry?.mfn_id;}}
 if(!id)throw new Error('Trip not saved. Review the request and retry.');
 const {data:trip}=await context.supabase.from('trips').select('id').eq('ride_request_id',id).maybeSingle();
 return {ok:true as const,id,mfnId,tripId:trip?.id??null,ownedOperation:true};
});
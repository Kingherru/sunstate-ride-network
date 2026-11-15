import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { rideRequestSchema } from './request-schemas';
import { occurrenceSchema, seriesRuleSchema, validateOccurrences, occurrenceRequest } from './trip-series';
const input=z.object({source:rideRequestSchema,rows:z.array(occurrenceSchema).min(1).max(100),rule:seriesRuleSchema,seriesId:z.string().uuid()}).strict();
export const createTripSeries=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>input.parse(v)).handler(async({data,context})=>{
  validateOccurrences(data.rows,new Date().toISOString().slice(0,10));
  const svc=await import('./requests/request-service.server');
  const requester=await svc.resolveRequester();
  if(requester.userId!==context.userId||!requester.workspaceId)throw new Error('One authorized creating workspace is required.');
  // Validate every row before the first insert; each insert uses the same request guards as single intake.
  const requests=data.rows.map(row=>occurrenceRequest(data.source,row));
  const results: {index:number;date:string;id?:string;mfnId?:string|null;error?:string}[]=[];
  for(const [index,request] of requests.entries()){
    const {data:prior}=await context.supabase.from('ride_requests').select('id,mfn_id').eq('actor_user_id',context.userId).eq('series_id',data.seriesId).eq('series_index',index).maybeSingle();
    if(prior){results.push({index,date:request.pickupDate,id:prior.id,mfnId:prior.mfn_id});continue;}
    const {data:existing,error}=await context.supabase.from('ride_requests').select('id').eq('workspace_id',requester.workspaceId).eq('pickup_date',request.pickupDate).eq('pickup_time',request.pickupTime).eq('patient_first_name',request.patientFirstName).eq('patient_last_name',request.patientLastName).eq('pickup_address',request.pickupAddress).eq('dropoff_address',request.dropoffAddress).not('status','in','(canceled,cancelled)').limit(1);
    if(error){results.push({index,date:request.pickupDate,error:'Could not verify duplicates; nothing created for this row.'});continue;}
    if(existing?.length){results.push({index,date:request.pickupDate,error:'Matching request already exists; review before copying.'});continue;}
    const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([request.patientFirstName,request.patientLastName,request.patientPhone,request.pickupAddress,request.dropoffAddress,request.pickupDate,request.pickupTime,request.transportType]))))).map(b=>b.toString(16).padStart(2,'0')).join('');
    const r=await svc.insertPassengerRequest(request,{requesterUserId:context.userId,actorUserId:context.userId,workspaceId:requester.workspaceId,submittedVia:'portal',skipNotify:true,series:{id:data.seriesId,index,fingerprint,evidence:{rule:data.rule,occurrence:data.rows[index],count:requests.length}}});
    results.push(r.ok?{index,date:request.pickupDate,id:r.id,mfnId:r.mfnId}:{index,date:request.pickupDate,error:'Request rejected by account, patient, provider or eligibility rules. No row was created.'});
  }
  return {seriesId:data.seriesId,results};
});

/** Read-only preflight, with the same user-scoped duplicate visibility as creation. */
export const previewTripSeries=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((v:unknown)=>input.parse(v)).handler(async({data,context})=>{
 validateOccurrences(data.rows,new Date().toISOString().slice(0,10));
 const svc=await import('./requests/request-service.server');const requester=await svc.resolveRequester();if(!requester.workspaceId||requester.userId!==context.userId)throw new Error('One authorized creating workspace is required.');
 const requests=data.rows.map(row=>occurrenceRequest(data.source,row));const duplicates:number[]=[];
 for(const [index,r] of requests.entries()){const {data:matches,error}=await context.supabase.from('ride_requests').select('id').eq('workspace_id',requester.workspaceId).eq('pickup_date',r.pickupDate).eq('pickup_time',r.pickupTime).eq('patient_first_name',r.patientFirstName).eq('patient_last_name',r.patientLastName).eq('pickup_address',r.pickupAddress).eq('dropoff_address',r.dropoffAddress).not('status','in','(canceled,cancelled)').limit(1);if(error)throw new Error('Duplicate checks unavailable; creation is blocked.');if(matches?.length)duplicates.push(index);}
 return {duplicates};
});

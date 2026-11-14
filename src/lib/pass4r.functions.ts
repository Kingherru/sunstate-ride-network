import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { serviceRoles } from './pass4r-rules';
export const saveServiceRoles = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({workspaceId:z.string().uuid(),roles:z.array(z.enum(serviceRoles)).max(3),confirmed:z.literal(true)}).strict().parse(i)).handler(async({data,context})=>{
 const {error}=await context.supabase.rpc('save_provider_service_roles',{_ws:data.workspaceId,_roles:data.roles});if(error)throw new Error('Only the authorized provider owner can save service roles.');return {ok:true};
});
export const getDriverSuggestion = createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({patientId:z.string().uuid(),service:z.enum(['ambulatory','wheelchair','stretcher']).default('ambulatory'),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()}).parse(i)).handler(async({data,context})=>{
 const {data:out,error}=await context.supabase.rpc('patient_driver_suggestion',{_patient:data.patientId,_service:data.service,...(data.date?{_date:data.date}:{})});if(error)throw new Error('Driver suggestion unavailable for this patient.');return out as {driverId:string|null;warning:string|null;source:string};
});
export type ConnectionAlert={id:string;name:string;accountType:string;relationshipType:string;connectedAt:string;readAt:string|null;workspaceId:string;otherWorkspaceId:string};
export const getTripDriverSuggestion=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({tripId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{const {data:out,error}=await context.supabase.rpc('trip_driver_suggestion',{_trip:data.tripId});if(error)throw new Error('Driver suggestion unavailable');return out as {driverId:string|null;warning:string|null;source:string};});
export const listConnectionAlerts=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).handler(async({context}):Promise<ConnectionAlert[]>=>{
 const {data:members}=await context.supabase.from('workspace_members').select('workspace_id').eq('user_id',context.userId).is('removed_at',null);
 const own=new Set((members??[]).map(m=>m.workspace_id));
 const {data,error}=await context.supabase.from('notifications').select('id,body,read_at,created_at,communication').eq('user_id',context.userId).eq('type','accepted_connection').is('dismissed_at',null).order('created_at',{ascending:false});if(error)throw new Error('Connection alerts unavailable.');
 return (data??[]).flatMap(n=>{const c=n.communication as Record<string,string>|null;if(!c||!own.has(c.workspaceId))return [];return [{id:n.id,name:n.body??'Connected account',accountType:c.accountType,relationshipType:c.relationshipType??'business',connectedAt:c.acceptedAt??n.created_at,readAt:n.read_at,workspaceId:c.workspaceId,otherWorkspaceId:c.otherWorkspaceId}];});
});
export const updateConnectionAlerts=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>z.object({action:z.enum(['read','dismiss']),ids:z.array(z.string().uuid()).max(200).optional()}).strict().parse(i)).handler(async({data,context})=>{
 let q=context.supabase.from('notifications').update(data.action==='dismiss'?{dismissed_at:new Date().toISOString()}:{read_at:new Date().toISOString()}).eq('user_id',context.userId).eq('type','accepted_connection').is('dismissed_at',null);if(data.ids)q=q.in('id',data.ids);const {error}=await q;if(error)throw new Error('Could not update connection alerts.');return {ok:true};
});
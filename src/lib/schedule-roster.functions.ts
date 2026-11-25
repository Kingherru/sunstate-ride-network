import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { recommendSchedule } from './schedule-planning';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const scope=z.object({workspaceId:z.string().uuid(),date:day});
export const getDayRoster=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.parse(i)).handler(async({data,context})=>{
 const {data:rows,error}=await (context.supabase as any).rpc('schedule_day_roster',{_workspace:data.workspaceId,_date:data.date});if(error)throw new Error(error.message);return rows as {driver_id:string}[];
});
export const setDayRoster=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.extend({driverId:z.string().uuid(),scheduled:z.boolean()}).parse(i)).handler(async({data,context})=>{
 const {data:event,error}=await (context.supabase as any).rpc('set_schedule_day_driver',{_workspace:data.workspaceId,_date:data.date,_driver:data.driverId,_scheduled:data.scheduled});if(error)throw new Error(error.message);
 if(event){const {notifyScheduleEvent}=await import('./schedule-notices.server');await notifyScheduleEvent(String(event));}return {ok:true};
});
export const confirmScheduleBatch=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.extend({key:z.string().uuid(),items:z.array(z.object({tripId:z.string().uuid(),driverId:z.string().uuid(),vehicleId:z.string().uuid().nullable(),start:z.string().regex(/^\d{2}:\d{2}$/),end:z.string().regex(/^\d{2}:\d{2}$/),version:z.string().nullable()})).min(1).max(50)}).parse(i)).handler(async({data,context})=>{
 const {error}=await (context.supabase as any).rpc('confirm_schedule_batch',{_workspace:data.workspaceId,_date:data.date,_key:data.key,_items:data.items});if(error)throw new Error(error.message);
 const {notifyDriverAssignment}=await import('./driver-assignment-notify.server');for(const item of data.items)await notifyDriverAssignment(item.tripId);return {ok:true};
});
export const getScheduleRecommendations=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.parse(i)).handler(async({data,context})=>{
 const db=context.supabase as any;
 const {data:allowed,error:gate}=await db.rpc('network_workspace_access',{_ws:data.workspaceId,_manage:true});if(gate||!allowed)throw new Error('Schedule management permission required');
 const [{data:trips,error:te},{data:drivers,error:de},{data:roster,error:re}]=await Promise.all([
 db.from('trips').select('id,driver_id,vehicle_id,pickup_address,dropoff_address,pickup_date,pickup_time,pickup_city,dropoff_city,pickup_state,dropoff_state,pickup_timezone,dropoff_timezone,regional_time_events,scheduled_start_time,assignment_end_time,updated_at,transport_type,estimated_duration_seconds,distance_miles,network_distribution_id,status,reservation_state,contractor_assigned_workspace_id,network_provider_workspace_id,created_by,assigned_to,ride_requests(saved_patient_id,workspace_id,provider_owned_operation)').eq('pickup_date',data.date).not('status','in','(completed,canceled,cancelled,no_show)').limit(200),
 db.from('drivers').select('id,status,availability,vacation_start,vacation_end,service_capabilities,regional_service_areas,primary_vehicle_id').eq('workspace_id',data.workspaceId),
 db.rpc('schedule_day_roster',{_workspace:data.workspaceId,_date:data.date})]);if(te||de||re)throw new Error('Schedule evidence unavailable');
 const scopedTrips=(trips??[]).filter((t:any)=>{
 const owner=t.contractor_assigned_workspace_id??t.network_provider_workspace_id??(t.ride_requests?.provider_owned_operation?t.ride_requests.workspace_id:null);
 return owner?owner===data.workspaceId:(t.created_by===context.userId||t.assigned_to===context.userId);
 });
 const {data:history}=await db.from('trips').select('driver_id,ride_requests(saved_patient_id)').eq('status','completed').not('driver_id','is',null).order('pickup_date',{ascending:false}).limit(300);
 const {data:bases}=await context.supabase.from('driver_schedule_bases').select('driver_id,address,city,state').eq('workspace_id',data.workspaceId);
 const routeEvidence:Record<string,{seconds:number;miles:number;source:string}>={};
 const pairs:(()=>Promise<void>)[]=[];
 for(const t of scopedTrips)if(!t.driver_id)for(const b of bases??[])if((roster??[]).some((r:any)=>r.driver_id===b.driver_id)&&pairs.length<12)pairs.push(async()=>{const {getScheduleDriveEvidence}=await import('./schedule-routing.server');const e=await getScheduleDriveEvidence(`${b.address}, ${b.city}, ${b.state}`,`${t.pickup_address}, ${t.pickup_city}, ${t.pickup_state}`);if(e)routeEvidence[`${t.id}:${b.driver_id}`]=e;});
 for(let start=0;start<pairs.length;start+=3)await Promise.all(pairs.slice(start,start+3).map(fn=>fn()));
 return recommendSchedule({date:data.date,trips:scopedTrips.map((t:any)=>({...t,assigned_driver_id:t.driver_id,saved_patient_id:t.ride_requests?.saved_patient_id})),drivers:drivers??[],rosterIds:(roster??[]).map((r:any)=>r.driver_id),routeEvidence,history:(history??[]).filter((h:any)=>h.ride_requests?.saved_patient_id).map((h:any)=>({patientId:h.ride_requests.saved_patient_id,driverId:h.driver_id}))});
});

/** Safe delivery statuses only. Management is verified as caller before the privileged audit reader is loaded. */
export const getScheduleNoticeHistory=createServerFn({method:'GET'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.parse(i)).handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('network_workspace_access',{_ws:data.workspaceId,_manage:true});if(!allowed)throw new Error('Schedule management required');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:events,error}=await supabaseAdmin.from('account_security_audit').select('id,details').eq('workspace_id',data.workspaceId).eq('event_type','schedule_driver_changed').eq('range_start',data.date).order('created_at',{ascending:false}).limit(20);if(error)throw new Error('Notice history unavailable');
 const rows:{id:string;driverId:string;kind:string;email:string;sms:string;retryable:boolean}[]=[];
 for(let start=0;start<(events??[]).length;start+=6)await Promise.all((events??[]).slice(start,start+6).map(async e=>{
 const d=e.details as Record<string,unknown>;const {data:outcomes}=await supabaseAdmin.from('account_security_audit').select('result,details').eq('correlation_id',e.id).eq('event_type','schedule_notice_channel').order('created_at',{ascending:false});
 const latest=(channel:string)=>outcomes?.find(o=>(o.details as Record<string,unknown>)['key']===`schedule-${e.id}-${String(d['driverId'])}-${channel}`)?.result??'off / not attempted';
 const email=latest('email'),sms=latest('sms');rows.push({id:e.id,driverId:String(d['driverId']),kind:String(d['kind']),email,sms,retryable:email==='failed'||sms==='failed'});
 }));return rows;
});
export const retryScheduleNotice=createServerFn({method:'POST'}).middleware([requireSupabaseAuth]).inputValidator((i:unknown)=>scope.extend({eventId:z.string().uuid()}).parse(i)).handler(async({data,context})=>{
 const {data:allowed}=await context.supabase.rpc('network_workspace_access',{_ws:data.workspaceId,_manage:true});if(!allowed)throw new Error('Schedule management required');
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const {data:event}=await supabaseAdmin.from('account_security_audit').select('id').eq('id',data.eventId).eq('workspace_id',data.workspaceId).eq('range_start',data.date).eq('event_type','schedule_driver_changed').maybeSingle();if(!event)throw new Error('Schedule event unavailable');
 const {notifyScheduleEvent}=await import('./schedule-notices.server');await notifyScheduleEvent(event.id);return {ok:true};
});

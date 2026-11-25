/** Invoked only after a scoped assignment RPC commits; immutable trigger events own recipients. */
export async function notifyDriverAssignment(tripId:string){
 try{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:last}=await supabaseAdmin.from('trip_dispatch_events').select('created_at').eq('trip_id',tripId).eq('event_type','resources_assigned').order('created_at',{ascending:false}).limit(1).maybeSingle();if(!last)return;
 const {data:events}=await supabaseAdmin.from('account_security_audit').select('id').eq('correlation_id',tripId).eq('event_type','schedule_driver_changed').gte('created_at',last.created_at).order('created_at',{ascending:false}).limit(2);
 const {notifyScheduleEvent}=await import('./schedule-notices.server');for(const event of events??[])await notifyScheduleEvent(event.id);
 }catch{/* Notice failure cannot invalidate a saved assignment. */}
}

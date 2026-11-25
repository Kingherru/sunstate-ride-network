import { deliverScheduleNotice, type ScheduleNoticeEvent } from './schedule-notice-rules';
/** No transport runs unless BOTH launch and saved channel consents are on. */
export async function notifyScheduleEvent(eventId:string){
 try{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');const db=supabaseAdmin as any;
 const {data:ev}=await db.from('account_security_audit').select('id,workspace_id,details').eq('id',eventId).eq('event_type','schedule_driver_changed').maybeSingle();if(!ev)return;
 const event:ScheduleNoticeEvent={id:ev.id,driverId:ev.details.driverId,date:ev.details.date,time:ev.details.time,kind:ev.details.kind};
 const [{data:d},{data:w},{data:f}]=await Promise.all([db.from('drivers').select('id,status,email,phone,assignment_email_enabled,assignment_sms_enabled,workspace_id').eq('id',event.driverId).eq('workspace_id',ev.workspace_id).maybeSingle(),db.from('workspaces').select('driver_assignment_email_enabled,driver_assignment_sms_enabled').eq('id',ev.workspace_id).maybeSingle(),db.from('platform_launch_flags').select('enabled').eq('key','driver_assignment_notifications').maybeSingle()]);if(!d||d.status!=='active'||!w||!f?.enabled)return;
 const gatewayKey=process.env['TWILIO_API_KEY'],lovableKey=process.env['LOVABLE_API_KEY'],from=process.env['SCHEDULE_SMS_FROM'];
 await deliverScheduleNotice({event,contact:{email:d.email,phone:d.phone,emailConsent:!!d.assignment_email_enabled,smsConsent:!!d.assignment_sms_enabled,providerEmail:!!w.driver_assignment_email_enabled,providerSms:!!w.driver_assignment_sms_enabled},enabled:true,smsConfigured:!!gatewayKey&&!!lovableKey&&!!from,
 claim:async key=>{const {data,error}=await db.rpc('claim_schedule_notice_channel',{_event:event.id,_key:key});return !error&&data===true;},
 record:async(key,state)=>{await db.rpc('record_schedule_notice_channel',{_event:event.id,_key:key,_state:state});},
 email:async(to,key)=>{const {sendTemplateEmail}=await import('./email-templates/send-email');const r=await sendTemplateEmail('driver-schedule',to,{templateData:{periodLabel:`Schedule updated — ${event.date}`,trips:[],noticeOnly:true},idempotencyKey:key});if(!r.sent){const e=new Error('Recipient suppressed');e.name='RecipientSuppressedError';throw e;}},
 sms:async(to,body)=>{if(!gatewayKey||!lovableKey||!from)throw new Error('SMS not configured');if(!/^\+[1-9]\d{7,14}$/.test(to))throw new Error('Saved SMS contact must use international format');let r:Response;try{r=await fetch('https://connector-gateway.lovable.dev/twilio/Messages.json',{method:'POST',headers:{Authorization:`Bearer ${lovableKey}`,'X-Connection-Api-Key':gatewayKey,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({To:to,From:from,Body:body})});}catch{const e=new Error('SMS outcome unknown; do not automatically retry');e.name='UncertainSmsError';throw e;}if(r.status>=500){const e=new Error('SMS server outcome unknown; held for review');e.name='UncertainSmsError';throw e;}if(!r.ok){const body=await r.text();console.error(`SMS provider failed [${r.status}]: ${body}`);throw new Error(`SMS provider failed [${r.status}]: ${body}`);}},
 });
 }catch{/* notices cannot undo saved roster or assignments */}
}

export type ScheduleNoticeEvent={id:string;driverId:string;date:string;time?:string|null;kind:'rostered'|'removed'|'assignment_changed'|'assignment_removed'};
export type NoticeContact={email:string|null;phone:string|null;emailConsent:boolean;smsConsent:boolean;providerEmail:boolean;providerSms:boolean};
export type DeliveryState='sent'|'failed'|'suppressed'|'unavailable'|'uncertain';
export function scheduleNoticeKey(e:ScheduleNoticeEvent,channel:'email'|'sms'){return `schedule-${e.id}-${e.driverId}-${channel}`;}
export function scheduleSms(e:ScheduleNoticeEvent){return `MY FLORIDA NEMT: Your schedule for ${e.date}${e.time?` at ${e.time.slice(0,5)}`:''} has changed. Sign in to view your schedule: https://myfloridanemt.com/login`;}
/** The same event runner is used with a fake sink in tests and server-backed claims in the app. */
export async function deliverScheduleNotice(o:{event:ScheduleNoticeEvent;contact:NoticeContact;enabled:boolean;smsConfigured:boolean;claim:(key:string)=>Promise<boolean>;record:(key:string,state:DeliveryState)=>Promise<void>;email:(to:string,key:string)=>Promise<void>;sms:(to:string,body:string,key:string)=>Promise<void>}){
 const result:Partial<Record<'email'|'sms',DeliveryState>>={};
 for(const channel of ['email','sms'] as const){
  const key=scheduleNoticeKey(o.event,channel);
  const contact=channel==='email'?o.contact.email:o.contact.phone;
  const consent=channel==='email'?o.contact.emailConsent&&o.contact.providerEmail:o.contact.smsConsent&&o.contact.providerSms;
  if(!o.enabled||!consent||!contact){result[channel]='suppressed';continue;}
  if(channel==='sms'&&!o.smsConfigured){result[channel]='unavailable';continue;}
  if(!await o.claim(key))continue;
  try{if(channel==='email')await o.email(contact,key);else await o.sms(contact,scheduleSms(o.event),key);result[channel]='sent';}
  catch(e){result[channel]=e instanceof Error&&e.name==='UncertainSmsError'?'uncertain':'failed';}
  await o.record(key,result[channel]??'failed');
 }
 return result;
}

import { z } from 'zod';
import { resolveLocalPickup } from './communication-rules';
import { supportedTimezone } from './us-timezone';
import { stateCodeSchema } from './us-geography';

const eventSchema = z.object({kind:z.string(),date:z.string(),time:z.string(),timezone:z.string().optional(),utc:z.string().nullable().optional(),status:z.string()});
export type RegionalRecord = {pickup_date?:string|null;pickup_time?:string|null;scheduled_start_time?:string|null;assignment_end_time?:string|null;pickup_timezone?:string|null;dropoff_timezone?:string|null;regional_time_events?:unknown;estimated_duration_seconds?:number|null};
/** Stored instants are accepted only when they agree with the explicit local event. */
export function verifiedEvents(raw:unknown) {
  const parsed=z.array(eventSchema).safeParse(raw);
  if(!parsed.success) return [];
  return parsed.data.map(e=>{const instant=supportedTimezone(e.timezone??'')?resolveLocalPickup(e.date,e.time,e.timezone??''):null;return {...e,verified:e.status==='resolved'&&instant!==null&&!!e.utc&&Date.parse(e.utc)===instant};});
}
export function scheduleInterval(t:RegionalRecord) {
  const events=verifiedEvents(t.regional_time_events),pickup=events.find(e=>e.kind==='pickup');
  if(!pickup?.verified||events.some(e=>!e.verified)||!supportedTimezone(t.pickup_timezone??'')||pickup.timezone!==t.pickup_timezone||pickup.date!==t.pickup_date||pickup.time.slice(0,5)!==t.pickup_time?.slice(0,5))return null;
  const start=resolveLocalPickup(pickup.date,t.scheduled_start_time??pickup.time,pickup.timezone??'');
  if(start===null)return null;
  const last=[...events].reverse().find(e=>['dropoff','return_dropoff'].includes(e.kind));
  let end=last?.utc?Date.parse(last.utc):null;
  if(t.assignment_end_time) {
    const date=last?.date??pickup.date;
    const next=new Date(date+'T12:00:00Z');
    if(!last&&t.assignment_end_time.slice(0,5)<=(t.scheduled_start_time??pickup.time).slice(0,5))next.setUTCDate(next.getUTCDate()+1);
    end=resolveLocalPickup(next.toISOString().slice(0,10),t.assignment_end_time,last?.timezone??pickup.timezone??'');
  } else if(end===null&&t.estimated_duration_seconds&&t.estimated_duration_seconds>0)end=start+t.estimated_duration_seconds*1000;
  return end!==null&&end>start?{start,end}:null;
}
export function scheduleTimeLabel(t:RegionalRecord) {
  const time=(t.scheduled_start_time??t.pickup_time??'').slice(0,5)||'Time not provided';
  const pickup=verifiedEvents(t.regional_time_events).find(e=>e.kind==='pickup');
  if(!pickup?.verified||pickup.timezone!==t.pickup_timezone||pickup.date!==t.pickup_date||pickup.time.slice(0,5)!==t.pickup_time?.slice(0,5))return `${time} · Timezone review required`;
  return t.pickup_timezone!==t.dropoff_timezone?`${time} · ${pickup.timezone}`:time;
}
const value=(r:Record<string,unknown>,...keys:string[])=>keys.map(k=>r[k]).find(v=>typeof v==='string') as string|undefined;
export function regionalInvoiceProjection(r:Record<string,unknown>) {
  const state=(...keys:string[])=>{const v=value(r,...keys);return stateCodeSchema.safeParse(v).success?v??null:null;};
  const zone=(...keys:string[])=>{const v=value(r,...keys);return v&&supportedTimezone(v)?v:null;};
  const zip=(...keys:string[])=>{const v=value(r,...keys);return v&&/^\d{5}(-\d{4})?$/.test(v)?v:null;};
  const events=verifiedEvents(r.regional_time_events??r.events);
  const evidence=r.regional_evidence as Record<string,unknown>|undefined;
  return {pickupState:state('pickup_state','pickupState'),destinationState:state('dropoff_state','dropoffState','destinationState'),pickupTimezone:zone('pickup_timezone','pickupTimezone'),destinationTimezone:zone('dropoff_timezone','dropoffTimezone','destinationTimezone'),pickupZip:zip('pickup_zip','pickupZip'),destinationZip:zip('dropoff_zip','dropoffZip','destinationZip'),pickupCounty:evidence?.pickup==='authoritative'?value(r,'pickup_county','pickupCounty')??null:null,destinationCounty:evidence?.destination==='authoritative'?value(r,'dropoff_county','dropoffCounty')??null:null,events:events.map(e=>({kind:e.kind,date:e.date,time:e.time,timezone:e.timezone??null,verified:e.verified,status:e.status,utc:e.utc??null}))};
}
export function regionalInvoiceLines(r:ReturnType<typeof regionalInvoiceProjection>) {
 return [`Pickup: ${[r.pickupState,r.pickupZip,r.pickupCounty].filter(Boolean).join(' · ')||'Geography review required'} · ${r.pickupTimezone??'Timezone review required'}`,`Destination: ${[r.destinationState,r.destinationZip,r.destinationCounty].filter(Boolean).join(' · ')||'Geography review required'} · ${r.destinationTimezone??'Timezone review required'}`,...r.events.map(e=>`${e.kind.replaceAll('_',' ')}: ${e.date} ${e.time.slice(0,5)} · ${e.verified?e.timezone:'Timezone review required'}`)];
}
/** A weekly overnight window includes the previous day's spillover; no guessed timezone. */
export function weeklyLocalAvailability(days:Record<string,{start?:string;end?:string;off?:boolean;closed?:boolean}>,day:number,time:string) {
 const current=days[String(day)],prior=days[String((day+6)%7)];
 const valid=(d:typeof current)=>!!d&&!d.off&&!d.closed&&!!d.start&&!!d.end&&d.start!==d.end;
 if(valid(current)&&current.start&&current.end&&(current.end>current.start?time>=current.start&&time<current.end:time>=current.start))return true;
 return !!(valid(prior)&&prior.start&&prior.end&&prior.end<prior.start&&time<prior.end);
}
export function regionalReadbackMatches(expected:Record<string,unknown>,stored:Record<string,unknown>){
 for(const key of ['pickup_state','dropoff_state','pickup_zip','dropoff_zip','pickup_county','dropoff_county','pickup_timezone','dropoff_timezone'])if(expected[key]!==stored[key])return false;
 const requested=verifiedEvents(expected.regional_time_events),retained=verifiedEvents(stored.regional_time_events);
 return requested.length===retained.length&&requested.every((e,i)=>{const r=retained[i];return !!r&&e.kind===r.kind&&e.date===r.date&&e.time===r.time&&e.timezone===r.timezone&&e.verified===r.verified;});
}
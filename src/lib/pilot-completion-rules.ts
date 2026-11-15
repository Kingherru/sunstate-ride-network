import {resolveLocalPickup} from './communication-rules';
import {REGIONS} from './coverage';
export const PILOT_CHECKS=['Selected sender workspaces','Selected receiving workspaces','Service scope','Geography scope','Nearby opportunity consent','Provider directory independence','Network entitlement mapping','Verification evidence','Vehicle and driver capability','Offer screens','Pre-acceptance messaging','Acceptance-time recheck','Atomic assignment','Concurrency protection','In-app notifications','External delivery intentionally off','Stripe and settlement intentionally separate','Emergency stop','Audit history'] as const;
export function unreadOffer(revision:number,watermark:number|null){return watermark===null||revision>watermark;}
export function checklistAllows(items:{ready:boolean}[]){return items.length===PILOT_CHECKS.length&&items.every(i=>i.ready);}
export function scopedPilotAccess(level:string,scoped:boolean,enabled:boolean){return {read:scoped&&['read','manage'].includes(level),manage:scoped&&level==='manage'&&enabled,configure:false};}
export function geographyMatch(input:{state:string;verified:boolean;county:string|null;zip?:boolean;city?:boolean;counties:string[];regions:string[]}){
 if(input.state!=='FL'||!input.verified)return null;
 if(input.zip)return {rank:100,label:'ZIP service-area match'};
 if(input.city)return {rank:70,label:'City service-area match'};
 const region=REGIONS.find(r=>r.counties.includes(input.county??''));
 if(!region)return null;
 if(input.counties.includes(input.county??''))return {rank:40,label:'County service-area match'};
 if(input.regions.includes(region.slug))return {rank:20,label:'Region service-area match'};
 return null;
}
export function providerLocalTime(date:string,time:string,tripZone:string,providerZone:string){
 if(!['America/New_York','America/Chicago'].includes(tripZone)||!['America/New_York','America/Chicago'].includes(providerZone))return null;
 const instant=resolveLocalPickup(date,time,tripZone);if(instant===null)return null;
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:providerZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant);
 const get=(k:string)=>parts.find(p=>p.type===k)?.value??'';
 return {instant,date:`${get('year')}-${get('month')}-${get('day')}`,time:`${get('hour')}:${get('minute')}`,timezone:providerZone};
}
export function recoveryAction(event:string){return ({acceptance_rolled_back:'Review assignment and schedule, then prepare a fresh eligible wave.',pilot_emergency_stop:'Master Admin review required. Pending offers remain frozen.',offer_withdrawn:'Prepare a new wave only after reviewing the owned trip.',expired:'Review eligibility and prepare the next manual wave.',eligibility_failed:'Review current eligibility evidence; no provider was assigned.'} as Record<string,string>)[event]??'Review the latest trip and offer evidence before continuing.';}
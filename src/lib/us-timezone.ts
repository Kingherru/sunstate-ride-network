import {resolveLocalPickup} from './communication-rules';
import {US_TIMEZONES} from './us-geography';
export function supportedTimezone(zone:string){return US_TIMEZONES.some(z=>z===zone);}
export function authoritativeInstant(date:string,time:string,zone:string,evidence:string){return evidence==='authoritative'&&supportedTimezone(zone)?resolveLocalPickup(date,time,zone):null;}
export function operatingWindow(date:string,start:string,end:string,zone:string){
 if(!supportedTimezone(zone)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||start===end)return null;
 const from=resolveLocalPickup(date,start,zone);const next=new Date(`${date}T12:00:00Z`);if(Number.isNaN(next.getTime()))return null;
 if(end<start)next.setUTCDate(next.getUTCDate()+1);
 const to=resolveLocalPickup(next.toISOString().slice(0,10),end,zone);
 return from!==null&&to!==null&&to>from?{from,to}:null;
}
export function withinOperatingHours(instant:number,date:string,start:string,end:string,zone:string,evidence:string){if(evidence!=='authoritative')return false;const w=operatingWindow(date,start,end,zone);return !!w&&instant>=w.from&&instant<w.to;}
import {resolveLocalPickup} from './communication-rules';
import {supportedTimezone} from './us-timezone';
export type LocalEvent={kind:string;date:string;time:string;timezone?:string;source?:string};
export function resolveTripEvents(events:LocalEvent[]){
 let previous:number|null=null;
 return events.map(event=>{
  const instant=event.time&&supportedTimezone(event.timezone??'')?resolveLocalPickup(event.date,event.time,event.timezone??''):null;
  const impossible=instant!==null&&previous!==null&&instant<previous;
  if(instant!==null)previous=instant;
  return {...event,source:event.source??'user_selected',utc:instant===null?null:new Date(instant).toISOString(),status:impossible?'impossible_order':instant===null?'review_required':'resolved'};
 });
}
export type RegionalTimedTrip={pickupDate?:string;pickupTime?:string;requestedDate?:string;requestedTime?:string;pickupTimezone?:string;dropoffTimezone?:string;appointmentTime?:string;dropoffDate?:string;dropoffTime?:string;returnDate?:string;returnPickupTime?:string;returnDropoffTime?:string;additionalStops?:{date?:string;pickupTime?:string;timezone?:string}[]};
export function tripTimeEvidence(t:RegionalTimedTrip){
 const date=t.pickupDate??t.requestedDate??'';
 const events:LocalEvent[]=[{kind:'pickup',date,time:t.pickupTime??t.requestedTime??'',timezone:t.pickupTimezone}];
 for(const [i,s] of (t.additionalStops??[]).entries())events.push({kind:`stop_${i+1}`,date:s.date||date,time:s.pickupTime??'',timezone:s.timezone});
 if(t.appointmentTime)events.push({kind:'appointment',date:t.dropoffDate||date,time:t.appointmentTime,timezone:t.dropoffTimezone});
 if(t.dropoffTime)events.push({kind:'dropoff',date:t.dropoffDate||date,time:t.dropoffTime,timezone:t.dropoffTimezone});
 if(t.returnPickupTime)events.push({kind:'return_pickup',date:t.returnDate||date,time:t.returnPickupTime,timezone:t.dropoffTimezone});
 if(t.returnDropoffTime)events.push({kind:'return_dropoff',date:t.returnDate||date,time:t.returnDropoffTime,timezone:t.pickupTimezone});
 return resolveTripEvents(events);
}
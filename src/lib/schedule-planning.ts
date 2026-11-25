import { eligibleDrivers, onTimeOff, tripWindow, type EligDriver, type EligTrip } from './schedule-eligibility';
import { scheduleInterval, type RegionalRecord } from './regional-projections';
import { formatTime12 } from './time-format';
export type ScheduleTrip = EligTrip & RegionalRecord & { pickup_date?: string | null; pickup_city?: string | null; dropoff_city?: string | null; pickup_state?: string | null; dropoff_state?: string | null; transport_type?: string | null; updated_at?: string | null; saved_patient_id?: string | null; estimated_duration_seconds?: number | null; distance_miles?: number | null; network_distribution_id?: string | null };
export type ScheduleDriver = EligDriver & { service_capabilities?: string[] | null; regional_service_areas?: unknown; primary_vehicle_id?: string | null };
export type Recommendation = { tripId: string; driverId: string; vehicleId: string | null; start: string; end: string; version: string | null; reasons: string[] };
export function clockTime(value: string | null | undefined, clock: '12' | '24' = '12') { return clock === '24' ? (value ?? '').slice(0, 5) : formatTime12(value); }
export function driverDayReason(d: EligDriver, date: string): string | null {
 if(d.status !== 'active') return 'Inactive driver';
 if(onTimeOff(d,date)) return 'Time off on this date';
 const a = d.availability as {mode?:string;days?:Record<string,{off?:boolean;start?:string;end?:string}>}|null;
 const day=a?.days?.[String(new Date(date+'T12:00:00').getDay())];
 if(a?.mode==='weekly'&&(!day||day.off)) return 'Not working on this day';
 return null;
}
export function dailyRosterIds(explicit: string[], trips: EligTrip[]) { return [...new Set([...explicit,...trips.map(t=>t.assigned_driver_id).filter((id):id is string=>!!id)])]; }
export function uniqueScheduleTrips<T extends {id:string}>(trips:T[]):T[] { return [...new Map(trips.map(t=>[t.id,t])).values()]; }
function areaMatches(d: ScheduleDriver,t:ScheduleTrip) {
 const raw=d.regional_service_areas as {areas?:{state?:string;locality?:string}[]}|null;
 const areas=raw?.areas??[];
 return !areas.length||areas.some(a=>(!a.state||a.state===t.pickup_state)&&(!a.locality||a.locality.toLowerCase()===t.pickup_city?.toLowerCase()))&&areas.some(a=>(!a.state||a.state===t.dropoff_state)&&(!a.locality||a.locality.toLowerCase()===t.dropoff_city?.toLowerCase()));
}
/** Advisory only: the locked confirmation RPC rechecks every recommendation. No invented drive distances. */
export function recommendSchedule(o:{date:string;trips:ScheduleTrip[];drivers:ScheduleDriver[];rosterIds:string[];history?:{patientId:string;driverId:string}[];routeEvidence?:Record<string,{seconds:number;miles:number;source:string}>}) {
 const proposed:Recommendation[]=[];const unmatched:{tripId:string;reason:string}[]=[];
 const occupied:ScheduleTrip[]=[...uniqueScheduleTrips(o.trips)];
 const ordered=uniqueScheduleTrips(o.trips).filter(t=>!t.assigned_driver_id).sort((a,b)=>(a.pickup_time??'').localeCompare(b.pickup_time??''));
 for(const t of ordered){
  const interval=scheduleInterval(t);const win=tripWindow(t);
  if(!interval||!win){unmatched.push({tripId:t.id,reason:'Reviewed local start/end and timezone evidence required'});continue;}
  const start=(t.scheduled_start_time??t.pickup_time??'').slice(0,5);
  const duration=Math.round((interval.end-interval.start)/60000);
  if(duration<=0||duration>=1440){unmatched.push({tripId:t.id,reason:'Multi-day timing requires individual review'});continue;}
  const end=t.assignment_end_time?.slice(0,5)??`${String(Math.floor((win[0]+duration)%1440/60)).padStart(2,'0')}:${String((win[0]+duration)%60).padStart(2,'0')}`;
  const timed={...t,assignment_end_time:end};
  const ds=eligibleDrivers(timed,o.drivers.filter(d=>o.rosterIds.includes(d.id)&&!driverDayReason(d,o.date)),occupied,o.date,new Date(o.date+'T12:00:00').getDay()).filter(d=>areaMatches(d,t)&&(!d.service_capabilities?.length||d.service_capabilities.includes(t.transport_type==='gurney'?'stretcher':t.transport_type??'ambulatory')));
  const prior=o.history?.find(h=>h.patientId===t.saved_patient_id)?.driverId;
  const completeProximity=ds.length>0&&ds.every(d=>!!o.routeEvidence?.[`${t.id}:${d.id}`]);
  ds.sort((a,b)=>Number(b.id===prior)-Number(a.id===prior)||(completeProximity?(o.routeEvidence?.[`${t.id}:${a.id}`]?.seconds??0)-(o.routeEvidence?.[`${t.id}:${b.id}`]?.seconds??0):0)||occupied.filter(x=>x.assigned_driver_id===a.id).length-occupied.filter(x=>x.assigned_driver_id===b.id).length||a.id.localeCompare(b.id));
  const d=ds[0];if(!d){unmatched.push({tripId:t.id,reason:'No scheduled driver meets availability, service-area and non-overlap checks'});continue;}
  const reasons=[d.id===prior?'Prior completed patient–driver relationship':'Workload-balanced eligible scheduled driver',t.estimated_duration_seconds?'Saved route duration; not a fresh Maps request':'Reviewed trip interval; live route unavailable',t.distance_miles!=null?`Saved route distance: ${t.distance_miles} miles`:'Route distance unavailable; no proximity ranking',d.regional_service_areas?'Recorded service area checked':'No recorded service-area boundary'];
  const route=o.routeEvidence?.[`${t.id}:${d.id}`];reasons.push(completeProximity&&route?`${route.source} base-to-pickup: ${Math.ceil(route.seconds/60)} min, ${route.miles} miles`:'Private base proximity unavailable/incomplete; no proximity ranking');
  proposed.push({tripId:t.id,driverId:d.id,vehicleId:t.vehicle_id??null,start,end,version:t.updated_at??null,reasons});
  const ix=occupied.findIndex(x=>x.id===t.id);if(ix>=0)occupied[ix]={...timed,assigned_driver_id:d.id};
 }
 return {proposed,unmatched};
}

export function movedScheduleEnd(t:ScheduleTrip,start:string){const interval=scheduleInterval(t);const duration=interval?(interval.end-interval.start)/60000:t.estimated_duration_seconds? t.estimated_duration_seconds/60:null;if(duration===null||duration<=0)return null;const [h,m]=start.split(':').map(Number);if(h===undefined||m===undefined)return null;const end=(h*60+m+Math.ceil(duration))%1440;return `${String(Math.floor(end/60)).padStart(2,'0')}:${String(end%60).padStart(2,'0')}`;}

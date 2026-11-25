import {describe,it,expect} from 'vitest';
import {clockTime,dailyRosterIds,driverDayReason,recommendSchedule,uniqueScheduleTrips,movedScheduleEnd,type ScheduleTrip} from '../src/lib/schedule-planning';
import {resolveLocalPickup} from '../src/lib/communication-rules';
const date='2027-01-04';
function trip(id:string,start='09:00',end='10:00'):ScheduleTrip{return {id,pickup_date:date,pickup_time:start,assignment_end_time:end,pickup_timezone:'America/New_York',dropoff_timezone:'America/New_York',regional_time_events:[{kind:'pickup',date,time:start,timezone:'America/New_York',status:'resolved',utc:new Date(resolveLocalPickup(date,start,'America/New_York')??0).toISOString()},{kind:'dropoff',date,time:end,timezone:'America/New_York',status:'resolved',utc:new Date(resolveLocalPickup(date,end,'America/New_York')??0).toISOString()}]};}
const drivers=[{id:'a',status:'active'},{id:'b',status:'active'}];
describe('daily roster and reviewed recommendations',()=>{
 it('roster stays after its last trip is removed',()=>expect(dailyRosterIds(['a'],[])).toEqual(['a']));
 it('legacy assignments add a driver without duplicating a roster entry',()=>expect(dailyRosterIds(['a'],[{id:'t',assigned_driver_id:'a'},{id:'u',assigned_driver_id:'b'}])).toEqual(['a','b']));
 it('duplicate referral approval displays one authoritative trip',()=>expect(uniqueScheduleTrips([{id:'referral'},{id:'referral'}])).toHaveLength(1));
 it('12-hour is default and 24-hour keeps exact value',()=>{expect(clockTime('14:05')).toBe('2:05 PM');expect(clockTime('14:05','24')).toBe('14:05');});
 it('vacation and missing weekly day cannot roster',()=>{expect(driverDayReason({id:'v',status:'active',vacation_start:date,vacation_end:date},date)).toBe('Time off on this date');expect(driverDayReason({id:'s',status:'active',availability:{mode:'weekly',days:{}}},date)).toBe('Not working on this day');});
 it('unscheduled drivers never enter a proposed batch',()=>expect(recommendSchedule({date,trips:[trip('t')],drivers,rosterIds:['b']}).proposed[0]?.driverId).toBe('b'));
 it('proposed overlaps are filtered against earlier proposed items',()=>{const r=recommendSchedule({date,trips:[trip('t'),trip('u','09:30','10:30')],drivers:[drivers[0]??{id:'a'}],rosterIds:['a']});expect(r.proposed).toHaveLength(1);expect(r.unmatched[0]?.tripId).toBe('u');});
 it('missing local-time evidence never becomes a recommendation',()=>expect(recommendSchedule({date,trips:[{id:'bad',pickup_time:'09:00'}],drivers,rosterIds:['a']}).proposed).toHaveLength(0));
 it('prior completed relationship outranks balanced workload',()=>{const t={...trip('t'),saved_patient_id:'p'};expect(recommendSchedule({date,trips:[t],drivers,rosterIds:['a','b'],history:[{patientId:'p',driverId:'b'}]}).proposed[0]?.driverId).toBe('b');});
 it('complete actual route evidence chooses nearer starting base',()=>{const r=recommendSchedule({date,trips:[trip('t')],drivers,rosterIds:['a','b'],routeEvidence:{'t:a':{seconds:900,miles:8,source:'Google Maps'},'t:b':{seconds:300,miles:2,source:'Google Maps'}}});expect(r.proposed[0]?.driverId).toBe('b');});
 it('recorded contractor service area excludes a mismatched city',()=>expect(recommendSchedule({date,trips:[{...trip('t'),pickup_city:'Tampa',dropoff_city:'Tampa',pickup_state:'FL',dropoff_state:'FL'}],drivers:[{id:'a',status:'active',regional_service_areas:{areas:[{state:'FL',locality:'Orlando'}]}}],rosterIds:['a']}).proposed).toHaveLength(0));
 it('moving later retains actual reviewed duration and midnight wrap',()=>{expect(movedScheduleEnd(trip('t'),'17:00')).toBe('18:00');expect(movedScheduleEnd(trip('t'),'23:30')).toBe('00:30');});
});

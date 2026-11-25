import {describe,it,expect} from 'vitest';
import {routeArrivalPatch,manualArrivalFromDraft,estimateDropoffTime,estimateDropoffDate,tripChronologyErrors,sumRouteSeconds} from '@/lib/trip-form-rules';
import {restoreDraftFields} from '@/lib/draft-fields';

describe('native trip time state rules',()=>{
  it('retains deliberate clearing across draft reopen while untouched estimates remain automatic',()=>{
    expect(manualArrivalFromDraft({dropoffTimeEdited:true},'')).toBe(true);
    expect(manualArrivalFromDraft({dropoffTimeEdited:false},'10:25')).toBe(false);
    expect(manualArrivalFromDraft({dropoff_time:'14:37'},'14:37')).toBe(true);
    expect(manualArrivalFromDraft(undefined,'')).toBe(false);
  });
  it('does not overwrite manually entered or corrected dropoff with a late route',()=>{
    expect(routeArrivalPatch(true,false,'10:25','2026-11-25')).toBeNull();
    expect(routeArrivalPatch(true,true,'11:25','2026-11-25')).toBeNull();
  });
  it('does not refill a deliberately cleared manual dropoff on success or failure',()=>{
    expect(routeArrivalPatch(true,false,'10:25','2026-11-25')).toBeNull();
    expect(routeArrivalPatch(true,false,null,null)).toBeNull();
  });
  it('refreshes untouched arrival and clears stale automatic evidence on route failure',()=>{
    expect(routeArrivalPatch(false,false,'10:25','2026-11-25')).toEqual({dropoffTime:'10:25',dropoffDate:'2026-11-25'});
    expect(routeArrivalPatch(false,true,'11:30','2026-11-25')).toEqual({dropoffTime:'11:30',dropoffDate:'2026-11-25'});
    expect(routeArrivalPatch(false,true,null,null)).toEqual({dropoffTime:'',dropoffDate:''});
    expect(routeArrivalPatch(false,false,null,null)).toBeNull();
  });
  it('preserves midnight rollover in both stored fields',()=>{
    expect(routeArrivalPatch(false,false,estimateDropoffTime('23:50',1200),estimateDropoffDate('2026-12-31','23:50',1200))).toEqual({dropoffTime:'00:10',dropoffDate:'2027-01-01'});
  });
  it('retains exact minute values and clearing through local JSON draft restoration',()=>{
    const payload={pickupTime:'14:37',appointmentTime:'15:02',dropoffTime:'',returnPickupTime:'16:09',returnDropoffTime:'16:41',additionalStops:[{pickupTime:'17:13'}],requestedTime:'18:27'};
    expect(restoreDraftFields(JSON.parse(JSON.stringify(payload)),Object.keys(payload))).toEqual(payload);
  });
  it('appointment must be later than pickup without discarding times',()=>{
    const f={pickupTime:'14:37',appointmentTime:'14:37'};
    expect(tripChronologyErrors(f).appointmentTime).toBeTruthy();
    expect(f.appointmentTime).toBe('14:37');
    expect(tripChronologyErrors({...f,appointmentTime:'14:38'})).toEqual({});
  });
  it('round trip return must be at least five minutes after appointment',()=>{
    const f={tripType:'round_trip',pickupTime:'09:37',appointmentTime:'10:02',returnPickupTime:'10:06'};
    expect(tripChronologyErrors(f).returnPickupTime).toBeTruthy();
    expect(tripChronologyErrors({...f,returnPickupTime:'10:07'})).toEqual({});
  });
  it('multi trip respects same-date chronology and allows later-date earlier clock times',()=>{
    const f={tripType:'multi_trip',pickupDate:'2026-11-25',pickupTime:'23:37',additionalStops:[{date:'2026-11-25',pickupTime:'00:13'}]};
    expect(tripChronologyErrors(f)['additionalStops.0.pickupTime']).toBeTruthy();
    expect(tripChronologyErrors({...f,additionalStops:[{date:'2026-11-26',pickupTime:'00:13'}]})).toEqual({});
    expect(sumRouteSeconds([1200,600,900])).toBe(2700);
  });
});
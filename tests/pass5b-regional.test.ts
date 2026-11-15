import {describe,it,expect} from 'vitest';
import {resolveTripEvents,tripTimeEvidence} from '../src/lib/regional-trip-times';
import {operatingWindow} from '../src/lib/us-timezone';
import {publicServiceAreas,directoryStateMatch} from '../src/lib/regional-directory-rules';
import {regionalConfigurationAllowed,publicRegionContext} from '../src/lib/regional-site';
import {regionalSchedulingReason} from '../src/lib/regional-scheduling-rules';
import {mapRow} from '../src/lib/csv-import';
describe('Regional event persistence',()=>{
 it('carries explicit CSV endpoint geography and local destination fields',()=>expect(mapRow('passenger',{pickup_state:'FL',dropoff_state:'GA',pickup_zip:'32301',dropoff_zip:'30301',pickup_timezone:'America/New_York',dropoff_timezone:'America/Chicago',dropoff_date:'2026-11-21',dropoff_time:'01:00'})).toMatchObject({pickupState:'FL',dropoffState:'GA',pickupZip:'32301',dropoffZip:'30301',dropoffDate:'2026-11-21',dropoffTime:'01:00'}));
 it('retains local values and resolves cross-zone order',()=>{const e=resolveTripEvents([{kind:'pickup',date:'2026-11-20',time:'10:00',timezone:'America/New_York'},{kind:'stop',date:'2026-11-20',time:'09:30',timezone:'America/Chicago'}]);expect(e.map(x=>x.utc)).toEqual(['2026-11-20T15:00:00.000Z','2026-11-20T15:30:00.000Z']);expect(e[1].time).toBe('09:30');});
 it('detects impossible cross-zone order',()=>expect(resolveTripEvents([{kind:'pickup',date:'2026-11-20',time:'10:00',timezone:'America/Chicago'},{kind:'stop',date:'2026-11-20',time:'10:30',timezone:'America/New_York'}])[1].status).toBe('impossible_order'));
 it('requires review for DST gap',()=>expect(resolveTripEvents([{kind:'pickup',date:'2027-03-14',time:'02:30',timezone:'America/New_York'}])[0].utc).toBeNull());
 it('requires review for duplicate DST time',()=>expect(resolveTripEvents([{kind:'pickup',date:'2026-11-01',time:'01:30',timezone:'America/New_York'}])[0].status).toBe('review_required'));
 it('never guesses legacy timezone',()=>expect(tripTimeEvidence({pickupDate:'2026-11-20',pickupTime:'10:00'})[0].utc).toBeNull());
 it('supports overnight hours',()=>{const w=operatingWindow('2026-11-20','22:00','06:00','America/Chicago');expect(w&&w.to-w.from).toBe(8*3600000);});
 it('keeps individual stop dates and return timezone',()=>{const e=tripTimeEvidence({pickupDate:'2026-11-20',pickupTime:'22:00',pickupTimezone:'America/New_York',dropoffTimezone:'America/Chicago',additionalStops:[{date:'2026-11-21',pickupTime:'01:00',timezone:'America/Chicago'}],returnDate:'2026-11-22',returnPickupTime:'08:00'});expect(e[1].date).toBe('2026-11-21');expect(e[2].timezone).toBe('America/Chicago');});
});
describe('Directory privacy and region gates',()=>{
 it('requires cross-state consent',()=>expect(regionalSchedulingReason({authorized:true,pickupState:'FL',destinationState:'GA',timeResolved:true,crossStateConsent:false,vehicleCompatible:true,driverCompatible:true,eligibility:'configured'})).toBe('Cross-state service consent required'));
 it('blocks unconfigured state eligibility',()=>expect(regionalSchedulingReason({authorized:true,pickupState:'FL',destinationState:'GA',timeResolved:true,crossStateConsent:true,vehicleCompatible:true,driverCompatible:true,eligibility:'not_configured'})).toBe('State eligibility not configured'));
 it('drops private fields',()=>{const a=publicServiceAreas([{state:'GA',lat:1,address:'Private',document:'secret',radius:100}]);expect(a).toEqual([{state:'GA',countyEquivalent:undefined,countyType:undefined,locality:undefined,postalCode:undefined,region:undefined,evidence:'generalized'}]);});
 it('does not infer non-Florida service',()=>expect(directoryStateMatch('GA',[],true)).toBe(false));
 it('matches explicit state',()=>expect(directoryStateMatch('GA',[{state:'GA'}],false)).toBe(true));
 it('never grants regular admin configuration',()=>expect(regionalConfigurationAllowed(false,'foundation_only')).toBe(false));
 it('never allows activation from configuration',()=>expect(regionalConfigurationAllowed(true,'publicly_active')).toBe(false));
 it('keeps unsupported public context unavailable',()=>expect(publicRegionContext('GA')).toMatchObject({available:false,index:false}));
});
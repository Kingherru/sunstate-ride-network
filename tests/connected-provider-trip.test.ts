import {describe,it,expect,vi} from 'vitest';
import {coordinateTimezone} from '../src/lib/trip-location-timezone';
import {readMobility,writeMobility,MOBILITY_OPTIONS,matchingTripPatients} from '../src/lib/trip-mobility';
import {groupReservations,reservationCategory} from '../src/lib/provider-reservation-groups';
import {continueOwnedReferral,validateReferralReview} from '../src/lib/provider-referral-flow';
import {currentCheckoutConsent} from '../src/lib/payment-policy';
import {occurrenceRequest,validateOccurrences,seriesRuleSchema} from '../src/lib/trip-series';
import {rideRequestSchema} from '../src/lib/request-schemas';
const review={amountCents:12000,expiresAt:'2027-01-01T00:00:00Z',paymentAcknowledged:true,consent:currentCheckoutConsent(true)};
const source=rideRequestSchema.parse({patientFirstName:'Synthetic',patientLastName:'Passenger',patientPhone:'5555555555',pickupAddress:'Synthetic pickup',pickupCity:'Orlando',dropoffAddress:'Synthetic dropoff',dropoffCity:'Orlando',pickupDate:'2026-12-01',pickupTime:'09:00',transportType:'ambulatory',mobilityNotes:'Legacy oxygen details'});
describe('canonical provider mobility',()=>{
 it('retains every requested checkbox through canonical storage',()=>{expect(readMobility(writeMobility('',MOBILITY_OPTIONS)).selected).toEqual(MOBILITY_OPTIONS);expect(MOBILITY_OPTIONS).toHaveLength(8);});
 it('preserves legacy information through select and deselect',()=>{const text='Legacy oxygen details\nTransfer instructions';const stored=writeMobility(text,['Oxygen Required']);expect(readMobility(stored).legacy).toBe(text);expect(writeMobility(stored,[])).toBe(text);});
 it('survives request schema and date copies',()=>{const original={...source,mobilityNotes:writeMobility(source.mobilityNotes,['Walker or Cane'])};const copy=occurrenceRequest(original,{date:'2026-12-02',pickupTime:'11:00',appointmentTime:'',returnTime:'',returnDropoffTime:'',returnDate:''});expect(copy.mobilityNotes).toBe(original.mobilityNotes);expect(original.pickupDate).toBe('2026-12-01');});
 it('Child Care cannot be submitted or priced as passenger transport',()=>{expect(rideRequestSchema.safeParse({...source,transportType:'child_care'}).success).toBe(false);});
});
describe('authorized patient matches',()=>{
 const rows=[{id:'owned',first_name:'Pat',last_name:'Smith',phone:'(555) 555-0123',email:'pat@example.test'}];
 it.each(['Pat','Smith','5550123','pat@example'])('matches supplied authorized rows by %s',term=>expect(matchingTripPatients(rows,term).map(p=>p.id)).toEqual(['owned']));
 it('does not search absent workspace records or short terms',()=>{expect(matchingTripPatients(rows,'OtherAccount')).toEqual([]);expect(matchingTripPatients(rows,'p')).toEqual([]);});
});
describe('independent recurring occurrences',()=>{
 it('supports independent destination dates/times and round trips',()=>{const result=occurrenceRequest(source,{date:'2026-12-03',pickupTime:'08:00',appointmentTime:'09:00',dropoffDate:'2026-12-04',dropoffTime:'10:00',tripType:'round_trip',returnTime:'11:00',returnDropoffTime:'12:00',returnDate:'2026-12-04'});expect(result.dropoffDate).toBe('2026-12-04');expect(result.dropoffTime).toBe('10:00');expect(result.roundTrip).toBe(true);expect(result.customerQuoteId).toBeNull();expect(source.pickupDate).toBe('2026-12-01');});
 it('one way clears source return details',()=>{const result=occurrenceRequest({...source,tripType:'round_trip',returnPickupTime:'14:00'},{date:'2026-12-02',pickupTime:'09:00',appointmentTime:'',tripType:'one_way',returnTime:'14:00',returnDropoffTime:'',returnDate:'2026-12-02'});expect(result.roundTrip).toBe(false);expect(result.returnPickupTime).toBe('');});
 it('rejects 101 occurrences',()=>{const row={date:'2026-12-02',pickupTime:'09:00',appointmentTime:'',returnTime:'',returnDropoffTime:'',returnDate:''};expect(()=>validateOccurrences(Array(101).fill(row),'2026-11-20')).toThrow('100');});
});
describe('distinct referral intent and truthful outcomes',()=>{
 it('requires versioned consent',()=>expect(()=>validateReferralReview({...review,consent:{...review.consent,termsVersion:'old'}})).toThrow());
 it('requires payment responsibility',()=>expect(()=>validateReferralReview({...review,paymentAcknowledged:false})).toThrow());
 it('requires positive integer compensation and future expiration',()=>{expect(()=>validateReferralReview({...review,amountCents:0})).toThrow();expect(()=>validateReferralReview({...review,expiresAt:'2020-01-01T00:00:00Z'})).toThrow();});
 it('retains owned trip on preparation failure and never sends a wave',async()=>{const send=vi.fn();const r=await continueOwnedReferral('owned-trip',review,{prepare:async()=>{throw new Error('funding off');},send});expect(r.tripId).toBe('owned-trip');expect(r.message).toBe('Trip saved — referral not sent');expect(send).not.toHaveBeenCalled();});
 it('never claims preparation alone sent an offer',async()=>{const r=await continueOwnedReferral('owned-trip',review,{prepare:async()=> 'existing-distribution',send:async()=>{throw new Error('launch off');}});expect(r.sent).toBe(false);});
 it('zero eligible recipients is not delivery',async()=>{const r=await continueOwnedReferral('owned-trip',review,{prepare:async()=> 'existing',send:async()=>({recipients:0})});expect(r.sent).toBe(false);});
 it('only successful addressed wave reports sent',async()=>{const r=await continueOwnedReferral('owned-trip',review,{prepare:async()=> 'existing',send:async()=>({recipients:2})});expect(r.sent).toBe(true);});
});
describe('separate authorized reservation categories',()=>{
 it.each(['unconfirmed','booked','past','canceled','history'])('deduplicates every %s presentation',state=>{const rows=[{id:'o',status:state,source_workspace_id:'ws'},{id:'s',status:state,source_workspace_id:'ws',network_distribution_id:'d'},{id:'r',status:state,network_provider_workspace_id:'ws',network_distribution_id:'e'}];const groups=groupReservations([...rows,rows[1]],'ws','user');expect(groups.owned.map(r=>r.id)).toEqual(['o']);expect(groups.sent.map(r=>r.id)).toEqual(['s']);expect(groups.received.map(r=>r.id)).toEqual(['r']);expect(Object.values(groups).flat()).toHaveLength(3);});
 it('sender source evidence takes priority over assigned receiver metadata',()=>expect(reservationCategory({id:'x',source_workspace_id:'ws',network_distribution_id:'d',network_provider_workspace_id:'ws'},'ws','user')).toBe('sent'));
});

describe('endpoint-local timezone derivation',()=>{
 it('derives Orlando Eastern time and Pensacola Central time independently',()=>{expect(coordinateTimezone(28.5383,-81.3792)).toBe('America/New_York');expect(coordinateTimezone(30.4213,-87.2169)).toBe('America/Chicago');});
 it('never guesses absent coordinates',()=>{expect(coordinateTimezone(null,null)).toBe('');expect(coordinateTimezone(999,-81)).toBe('');});
});

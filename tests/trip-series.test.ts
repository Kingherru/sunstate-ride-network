import {describe,it,expect} from 'vitest';
import {generateOccurrences,validateOccurrences,occurrenceRequest,type SeriesRule} from '../src/lib/trip-series';
import {tripReviewKey,canAttachTripQuote} from '../src/lib/trip-workspace-review';
import {rideRequestSchema} from '../src/lib/request-schemas';
const rule:SeriesRule={mode:'weekly',start:'2026-11-16',end:'2026-12-01',limit:100,weekdays:[1,3],dates:[],excluded:[]};
describe('bounded trip occurrences',()=>{
 it('generates selected weekdays exactly',()=>expect(generateOccurrences(rule,'2026-11-15')).toEqual(['2026-11-16','2026-11-18','2026-11-23','2026-11-25','2026-11-30']));
 it('respects an occurrence maximum without an end',()=>expect(generateOccurrences({...rule,end:'',limit:3},'2026-11-15')).toEqual(['2026-11-16','2026-11-18','2026-11-23']));
 it('excludes explicit exceptions',()=>expect(generateOccurrences({...rule,excluded:['2026-11-18']},'2026-11-15')).not.toContain('2026-11-18'));
 it('monthly same-day skips nonexistent dates',()=>expect(generateOccurrences({...rule,mode:'monthly',start:'2027-01-31',end:'2027-04-30'},'2026-11-15')).toEqual(['2027-01-31','2027-03-31']));
 it('rejects unlimited recurrence',()=>expect(()=>generateOccurrences({...rule,limit:0},'2026-11-15')).toThrow());
 it('rejects past starts',()=>expect(()=>generateOccurrences({...rule,start:'2026-11-14'},'2026-11-15')).toThrow());
 it('rejects duplicate individual dates',()=>expect(()=>generateOccurrences({...rule,mode:'dates',dates:['2026-11-16','2026-11-16']},'2026-11-15')).toThrow());
 it('detects duplicate rows before creation',()=>{const row={date:'2026-11-16',pickupTime:'09:00',appointmentTime:'10:00',returnTime:'',returnDropoffTime:'',returnDate:''};expect(()=>validateOccurrences([row,row],'2026-11-15')).toThrow();});
 it('does not guess pickup time',()=>expect(()=>validateOccurrences([{date:'2026-11-16',pickupTime:'',appointmentTime:'',returnTime:'',returnDropoffTime:'',returnDate:''}],'2026-11-15')).toThrow());
 it('copy keeps authorized references but clears assignment and locked quote',()=>{const source=rideRequestSchema.parse({patientFirstName:'Synthetic',patientLastName:'Passenger',patientPhone:'5555555555',pickupAddress:'Synthetic pickup',pickupCity:'Tampa',dropoffAddress:'Synthetic destination',dropoffCity:'Tampa',pickupDate:'2026-11-16',pickupTime:'09:00',transportType:'ambulatory',confirmedProviderDriverId:'11111111-1111-4111-8111-111111111111',specialInstructions:'Retain reviewed notes'});const copy=occurrenceRequest(source,{date:'2026-11-17',pickupTime:'11:00',appointmentTime:'12:00',returnTime:'',returnDropoffTime:'',returnDate:''});expect(copy.specialInstructions).toBe('Retain reviewed notes');expect(copy.confirmedProviderDriverId).toBeNull();expect(copy.customerQuoteId).toBeNull();expect(copy.pickupTime).toBe('11:00');});
 it('changed pricing evidence invalidates review',()=>{const key=tripReviewKey({pickupTime:'09:00'},{miles:'12'});expect(canAttachTripQuote({currentKey:tripReviewKey({pickupTime:'09:00'},{miles:'13'}),confirmedKey:key,quoteId:'q',draftId:'d',referral:false})).toBe(false);});
 it('referral preparation never attaches normal invoice',()=>expect(canAttachTripQuote({currentKey:'same',confirmedKey:'same',quoteId:'q',draftId:'d',referral:true})).toBe(false));
});

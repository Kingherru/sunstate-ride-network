import {describe, expect, it} from 'vitest';
import {editedTimeValue, estimateDropoffTime, estimateDropoffDate, sumRouteSeconds, routePoints, tripChronologyErrors} from '@/lib/trip-form-rules';
import {workspaceQuoteInput, tripReviewKey, canAttachTripQuote} from '@/lib/trip-workspace-review';
import {calculateCustomerQuote, customerRatesFromLegacy} from '@/lib/provider-customer-pricing';
import type {DeliveryRequestInput} from '@/lib/request-schemas';

describe('editable canonical times', () => {
  it('retains minutes and PM chosen before an empty hour is completed', () => {
    const pending = {hour:'', tens:'3', ones:'7', period:'PM' as const};
    expect(editedTimeValue(pending)).toBe('');
    expect(editedTimeValue({...pending, hour:'2'})).toBe('14:37');
  });
  it('clearing any part removes the canonical value without accepting out-of-range times', () => {
    const time = {hour:'12', tens:'0', ones:'5', period:'AM' as const};
    expect(editedTimeValue(time)).toBe('00:05');
    expect(editedTimeValue({...time, tens:''})).toBe('');
    expect(editedTimeValue({...time, tens:'6'})).toBe('');
    expect(editedTimeValue({...time, hour:'13'})).toBe('');
    expect(editedTimeValue({...time, period:'PM'})).toBe('12:05');
  });
  it('preserves appointment and round-trip chronology', () => {
    expect(tripChronologyErrors({pickupTime:'14:37', appointmentTime:'14:36'}).appointmentTime).toBeTruthy();
    expect(tripChronologyErrors({tripType:'round_trip', pickupTime:'09:00', appointmentTime:'10:00', returnPickupTime:'10:04'}).returnPickupTime).toBeTruthy();
    expect(tripChronologyErrors({tripType:'round_trip', pickupTime:'09:00', appointmentTime:'10:00', returnPickupTime:'10:05'})).toEqual({});
  });
});
describe('actual duration interpretation (synthetic evidence, no Maps requests)', () => {
  it('adds outbound drive time and recalculates pickup edits', () => {
    expect(estimateDropoffTime('09:00', 1500)).toBe('09:25');
    expect(estimateDropoffTime('10:15', 1500)).toBe('10:40');
    expect(estimateDropoffTime('10:15', 1800)).toBe('10:45');
  });
  it('handles midnight and year rollover in canonical time and date', () => {
    expect(estimateDropoffTime('23:50', 1200)).toBe('00:10');
    expect(estimateDropoffDate('2026-12-31','23:50',1200)).toBe('2027-01-01');
    expect(estimateDropoffDate('2026-11-24','09:00',1500)).toBe('2026-11-24');
  });
  it('missing or malformed route duration never becomes an estimate', () => {
    expect(estimateDropoffTime('09:00',null)).toBeNull();
    expect(estimateDropoffTime('25:00',1500)).toBeNull();
    expect(estimateDropoffTime('09:00',NaN)).toBeNull();
    expect(estimateDropoffTime('09:00',0)).toBe('09:00');
  });
  it('never reports partial Multi Trip time as complete', () => {
    expect(sumRouteSeconds([1200,600,900])).toBe(2700);
    expect(sumRouteSeconds([1200,null,900])).toBeNull();
    expect(sumRouteSeconds([])).toBeNull();
    expect(sumRouteSeconds([1200,-1])).toBeNull();
    expect(sumRouteSeconds([1200,0])).toBe(1200);
  });
  it('leg edits/removal/reorder alter the current route identity', () => {
    const f = {tripType:'multi_trip',pickupAddress:'1 Main St',pickupCity:'Tampa',dropoffAddress:'2 Oak Ave',dropoffCity:'Tampa'};
    const a = {address:'3 Elm St',city:'Tampa'}, b = {address:'4 Pine St',city:'Tampa'};
    expect(routePoints({...f,additionalStops:[a,b]})).not.toEqual(routePoints({...f,additionalStops:[b,a]}));
    expect(routePoints({...f,additionalStops:[a]})).toHaveLength(3);
    expect(routePoints({...f,additionalStops:[{...a,address:''}]})).toBeNull();
  });
});
describe('delivery current-input pricing and retained quote safety', () => {
  const form = {requestedDate:'2026-12-01',requestedTime:'09:00',signatureRequired:false,requestCategory:'medical_delivery'} as DeliveryRequestInput;
  // Explicit synthetic configured book, never adopted or saved by the application.
  const book = customerRatesFromLegacy({delivery_base:20, delivery_per_mile:2, delivery_signature_surcharge:5, after_hours_addon:10});
  it('delivery mileage and signature refresh through existing provider rate rules', () => {
    const input = workspaceQuoteInput(form,'10','0');
    expect(input?.service).toBe('medical_delivery');
    if (!input) throw new Error('Expected valid delivery input');
    expect(calculateCustomerQuote(book,input).totalCents).toBe(4000);
    expect(calculateCustomerQuote(book,{...input,miles:15,signature:true}).totalCents).toBe(5500);
    expect(calculateCustomerQuote(book,{...input,pickupTime:'21:00'}).totalCents).toBe(5000);
  });
  it('missing mileage blocks pricing; changed delivery details cannot attach an old quote', () => {
    expect(workspaceQuoteInput(form,'','0')).toBeNull();
    const before = tripReviewKey(form);
    const after = tripReviewKey({...form,signatureRequired:true});
    expect(canAttachTripQuote({currentKey:after,confirmedKey:before,quoteId:'quote',draftId:'draft',referral:false})).toBe(false);
  });
});
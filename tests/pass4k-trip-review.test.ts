import { describe, it, expect } from 'vitest';
import { tripReviewKey, canAttachTripQuote, workspaceQuoteInput } from '../src/lib/trip-workspace-review';
import { patientDetailFields } from '../src/lib/patient-detail-presentation';
import { patientStage, patientTimeline } from '../src/lib/patient-timeline';
import type { RideRequestInput } from '../src/lib/request-schemas';

describe('Shared trip review and safe patient presentation', () => {
  const form = { pickupDate: '2026-11-08', pickupTime: '12:00', transportType: 'wheelchair', tripType: 'round_trip', additionalStops: [{ address: 'Synthetic stop' }] } as RideRequestInput;
  const key = tripReviewKey(form, { miles: '12', wait: '5', terms: 'Original' });
  const attachment = { currentKey: key, confirmedKey: key, quoteId: 'quote', draftId: 'draft', referral: false };
  it('attaches only the exact confirmed trip and price inputs', () => {
    expect(canAttachTripQuote(attachment)).toBe(true);
    expect(canAttachTripQuote({ ...attachment, currentKey: tripReviewKey(form, { miles: '13', wait: '5', terms: 'Original' }) })).toBe(false);
    expect(canAttachTripQuote({ ...attachment, currentKey: tripReviewKey({ ...form, pickupTime: '13:00' }, { miles: '12', wait: '5', terms: 'Original' }) })).toBe(false);
  });
  it('never attaches an owned quote while separate referral preparation is selected', () => {
    expect(canAttachTripQuote({ ...attachment, referral: true })).toBe(false);
    expect(canAttachTripQuote({ ...attachment, draftId: null })).toBe(false);
    expect(canAttachTripQuote({ ...attachment, confirmedKey: null })).toBe(false);
  });
  it('does not invent mileage and retains supported return and wait inputs', () => {
    expect(workspaceQuoteInput(form, '', '0')).toBeNull();
    expect(workspaceQuoteInput(form, '12', '5')).toMatchObject({ service: 'wheelchair', miles: 12, waitMinutes: 5, roundTrip: true, additionalStops: 1 });
    expect(workspaceQuoteInput(form, '-1', '5')).toBeNull();
  });
  it('Facility agreement review uses the returned immutable payload, not unrelated current edits', () => {
    const accepted = tripReviewKey(form);
    expect(canAttachTripQuote({ ...attachment, confirmedKey: accepted, currentKey: tripReviewKey(form) })).toBe(true);
    expect(canAttachTripQuote({ ...attachment, confirmedKey: accepted, currentKey: tripReviewKey({ ...form, payerId: 'another-payer' }) })).toBe(false);
  });
  it('patient detail allowlist cannot return notes, rates, offers, credentials or other patients', () => {
    const safe = patientDetailFields({ pickup_address: 'Synthetic pickup', transport_type: 'wheelchair', trip_type: 'one_way', special_instructions: 'PRIVATE', provider_notes: 'PRIVATE', margin: 'PRIVATE', offers: 'PRIVATE', card_number: 'PRIVATE', patient_first_name: 'PRIVATE', documents: 'PRIVATE' });
    expect(safe.find(f => f.label === 'Pickup')?.value).toBe('Synthetic pickup');
    expect(safe.find(f => f.label === 'Return information')?.value).toBe('Not Required');
    expect(JSON.stringify(safe)).not.toContain('PRIVATE');
    expect(patientDetailFields({ trip_type: 'round_trip', return_pickup_time: '14:00' }).find(f => f.label === 'Return pickup time')?.value).toBe('14:00');
  });
  it('retains actual safe stages and excludes private or invalid history', () => {
    expect(patientStage('pending')).toBe('Pending');
    expect(patientStage('approved')).toBe('Approved');
    expect(patientStage('scheduled')).toBe('Added to Dispatch Schedule');
    expect(patientStage('completed', true)).toBe('Completed');
    expect(patientStage('canceled', true)).toBe('Canceled');
    expect(patientTimeline([{ action: 'private_notes', at: '2026-11-08T03:00:00Z' }, { action: 'completed', at: 'invalid' }])).toEqual([]);
  });
});
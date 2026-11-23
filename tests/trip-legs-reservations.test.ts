import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rideRequestSchema } from '@/lib/request-schemas';
import { timeParts, canonicalTime, tripChronologyErrors, routePoints, sumRouteMiles, partialAddress, pendingBadge, referralBadges, isCanceledStatus, PROVIDER_FORM_SECTIONS } from '@/lib/trip-form-rules';
import { VISIBLE_MOBILITY_OPTIONS, PICKUP_OPTIONS, readPickupOptions, writePickupOptions, readMobility, writeMobility, mobilityOperationalFields } from '@/lib/trip-mobility';
import { PROVIDER_RESERVATION_TABS, reservationSectionFor } from '@/components/portal/provider-trip-navigation';
import { workspaceQuoteInput } from '@/lib/trip-workspace-review';

const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const later = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10);
const base = { pickupState: 'FL', dropoffState: 'FL', patientFirstName: 'Ann', patientLastName: 'Lee', patientPhone: '5555550100', pickupAddress: '1 Main St', pickupCity: 'Tampa', pickupDate: future, pickupTime: '09:00', dropoffAddress: '2 Oak Ave', dropoffCity: 'Tampa', transportType: 'ambulatory' as const };

describe('compact 12-hour time', () => {
  it('round-trips canonical 24-hour values', () => {
    expect(timeParts('14:37')).toEqual({ hour: 2, tens: 3, ones: 7, period: 'PM' });
    expect(canonicalTime({ hour: 12, tens: 0, ones: 5, period: 'AM' })).toBe('00:05');
    expect(canonicalTime({ hour: 12, tens: 4, ones: 9, period: 'PM' })).toBe('12:49');
    expect(() => canonicalTime({ hour: 13, tens: 0, ones: 0, period: 'AM' })).toThrow();
  });
});

describe('chronology', () => {
  it('appointment must be after pickup', () => {
    expect(tripChronologyErrors({ pickupTime: '09:00', appointmentTime: '09:00' }).appointmentTime).toBeTruthy();
    expect(tripChronologyErrors({ pickupTime: '09:00', appointmentTime: '09:30' }).appointmentTime).toBeUndefined();
  });
  it('round-trip return is at least 5 minutes after appointment on the same day', () => {
    const f = { tripType: 'round_trip', pickupDate: future, pickupTime: '09:00', appointmentTime: '10:00' };
    expect(tripChronologyErrors({ ...f, returnPickupTime: '10:04' }).returnPickupTime).toBeTruthy();
    expect(tripChronologyErrors({ ...f, returnPickupTime: '10:05' }).returnPickupTime).toBeUndefined();
    expect(tripChronologyErrors({ ...f, returnDate: later, returnPickupTime: '08:00' }).returnPickupTime).toBeUndefined();
  });
  it('multi-trip legs follow the preceding leg on the same date; cross-date legs are allowed', () => {
    const f = { tripType: 'multi_trip', pickupDate: future, pickupTime: '09:00' };
    expect(tripChronologyErrors({ ...f, additionalStops: [{ pickupTime: '08:30' }] })['additionalStops.0.pickupTime']).toBeTruthy();
    expect(tripChronologyErrors({ ...f, additionalStops: [{ pickupTime: '10:00' }, { pickupTime: '09:30' }] })['additionalStops.1.pickupTime']).toBeTruthy();
    expect(Object.keys(tripChronologyErrors({ ...f, additionalStops: [{ pickupTime: '10:00' }, { date: later, pickupTime: '07:00' }] }))).toEqual([]);
  });
  it('schema blocks invalid submission', () => {
    const r = rideRequestSchema.safeParse({ ...base, appointmentTime: '08:00' });
    expect(r.success).toBe(false);
    expect(rideRequestSchema.safeParse({ ...base, appointmentTime: '10:00' }).success).toBe(true);
  });
});

describe('route mileage', () => {
  const f = { pickupAddress: '1 Main St', pickupCity: 'Tampa', dropoffAddress: '2 Oak Ave', dropoffCity: 'Tampa' };
  it('orders points per trip type', () => {
    expect(routePoints({ ...f, tripType: 'one_way' })).toHaveLength(2);
    const rt = routePoints({ ...f, tripType: 'round_trip' })!;
    expect(rt).toHaveLength(3); expect(rt[0]).toBe(rt[2]);
    expect(routePoints({ ...f, tripType: 'multi_trip', additionalStops: [{ address: '3 Elm St', city: 'Clearwater' }, { address: '4 Pine St', city: 'Largo' }] })).toHaveLength(4);
    expect(routePoints({ ...f, tripType: 'multi_trip', additionalStops: [{ address: '', city: '' }] })).toBeNull();
  });
  it('sums every segment and never invents a missing one', () => {
    expect(sumRouteMiles([4.2, 3.3, 10])).toBe(17.5);
    expect(sumRouteMiles([4.2, null])).toBeNull();
    expect(sumRouteMiles([])).toBeNull();
  });
  it('quote input recomputes from mileage, round trip and legs', () => {
    const ride = rideRequestSchema.parse({ ...base, tripType: 'multi_trip', additionalStops: [{ address: '3 Elm St', city: 'Tampa', pickupTime: '10:00' }] });
    expect(workspaceQuoteInput(ride, '12.5', '0')).toMatchObject({ miles: 12.5, additionalStops: 1, roundTrip: false });
    expect(workspaceQuoteInput(ride, '', '0')).toBeNull();
  });
});

describe('pickup options and mobility', () => {
  it('moves the four choices out of Mobility Requirements', () => {
    for (const o of ['Additional Passenger or Escort', 'Door-to-Door Assistance', 'Assistance to Vehicle', 'Walker or Cane']) expect((VISIBLE_MOBILITY_OPTIONS as readonly string[]).includes(o)).toBe(false);
    expect(PICKUP_OPTIONS).toHaveLength(8);
  });
  it('legacy moved selections stay readable and operational', () => {
    const legacy = writeMobility('', ['Assistance to Vehicle', 'Wheelchair Required']);
    expect(readPickupOptions(legacy)).toEqual(['Assistance to Vehicle']);
    const next = writePickupOptions(legacy, ['Assistance to Vehicle', 'Curbside Pickup']);
    expect(readMobility(next).selected).toEqual(['Wheelchair Required']);
    expect(readPickupOptions(next)).toEqual(['Curbside Pickup', 'Assistance to Vehicle']);
    expect(mobilityOperationalFields(next, 'ambulatory').needs_assistance_to_vehicle).toBe(true);
  });
  it('Pickup Options sits between Pickup and Drop-Off', () => {
    expect(PROVIDER_FORM_SECTIONS.indexOf('Pickup Options')).toBe(PROVIDER_FORM_SECTIONS.indexOf('Pickup') + 1);
  });
});

describe('reservations presentation', () => {
  it('combines Drafts/Unconfirmed and folds Canceled into History', () => {
    expect(PROVIDER_RESERVATION_TABS.map(t => t.value)).toEqual(['pending', 'booked', 'past', 'history']);
    expect(reservationSectionFor('drafts')).toBe('pending');
    expect(reservationSectionFor('canceled')).toBe('history');
    expect(isCanceledStatus('Cancelled')).toBe(true);
  });
  it('patient-submitted trips are Unconfirmed, never Drafts', () => {
    expect(pendingBadge({ kind: 'trip', requester_user_id: 'patient' }, 'provider')).toBe('Patient Request · Unconfirmed');
    expect(pendingBadge({ kind: 'trip', requester_user_id: 'provider' }, 'provider')).toBe('Unconfirmed');
    expect(pendingBadge({ kind: 'draft' }, 'provider')).toBe('Draft');
  });
  it('referral badges keep direction and read state separate and never invent read state', () => {
    expect(referralBadges({ direction: 'received', unread: true, status: 'pending' })).toEqual(['Received', 'Unread', 'Unconfirmed']);
    expect(referralBadges({ direction: 'received', unread: false, status: 'accepted' })).toEqual(['Received', 'Read']);
    expect(referralBadges({ direction: 'sent', status: 'closed' })).toEqual(['Sent']);
  });
  it('list previews use partial addresses only', () => {
    expect(partialAddress('Tampa', '123 Main St', 'FL')).toBe('Tampa, FL');
    expect(partialAddress(null, '123 Main St')).toBe('Main St area');
    expect(partialAddress(null, null)).not.toMatch(/\d/);
  });
  it('Import & Export is its own tab and History has no import/export', () => {
    const trips = readFileSync('src/components/portal/ProviderTrips.tsx', 'utf8');
    expect(trips).toContain('label: "Import & Export"');
    const history = trips.slice(trips.indexOf("reservation === 'history'"), trips.indexOf('view === "transfer"'));
    expect(history).not.toContain('ProviderExports');
    expect(history).toContain('includeCanceled');
  });
});

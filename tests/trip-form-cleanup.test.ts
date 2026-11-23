import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { rideRequestSchema } from '@/lib/request-schemas';
import { PROVIDER_FORM_SECTIONS, totalPassengers, additionalFromTotal, resizeChildren, childCarePricing, childCareTransport, estimateDropoffTime, formatUsDate, formatUsTime, locationResolved, networkSafeChildCare, ADDITIONAL_PASSENGER_CHOICES } from '@/lib/trip-form-rules';
import { reservationCategory, groupReservations } from '@/lib/provider-reservation-groups';

const form = readFileSync('src/components/requests/RequestForm.tsx', 'utf8');
const future = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const base = { pickupState: 'FL', dropoffState: 'FL', patientFirstName: 'Ann', patientLastName: 'Lee', patientPhone: '5555550100', pickupAddress: '1 Main St', pickupCity: 'Tampa', pickupDate: future, pickupTime: '09:00', dropoffAddress: '2 Oak Ave', dropoffCity: 'Tampa', transportType: 'ambulatory' as const };

describe('provider form order', () => {
  it('renders sections in the approved order with Billing and Live Invoice last', () => {
    const positions = PROVIDER_FORM_SECTIONS.map(name => form.indexOf(`data-form-section="${name}"`));
    expect(positions.every(p => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(PROVIDER_FORM_SECTIONS.slice(-2)).toEqual(['Billing', 'Live Invoice']);
  });
  it('places the invitation beside the recurring-dates action, not after billing', () => {
    const row = form.indexOf('trip-secondary-actions');
    expect(form.indexOf('<ProviderInvitation', row)).toBeGreaterThan(row);
    expect(form.indexOf('<ProviderInvitation')).toBeLessThan(form.indexOf('data-form-section="Billing"'));
  });
  it('public form never renders the live invoice (invoice slot only from provider workspace)', () => {
    expect(form).not.toMatch(/<NewTripWorkspace|Live Invoice<\//);
  });
});

describe('additional passengers', () => {
  it('offers None through 5', () => expect([...ADDITIONAL_PASSENGER_CHOICES]).toEqual([0, 1, 2, 3, 4, 5]));
  it('stores primary rider plus additional', () => {
    expect(totalPassengers(0)).toBe(1);
    expect(totalPassengers(5)).toBe(6);
    expect(additionalFromTotal(4)).toBe(3);
  });
  it('keeps wheelchair positions within the total', () => {
    expect(rideRequestSchema.safeParse({ ...base, transportType: 'wheelchair', passengerCount: 1, wheelchairPositions: 2 }).success).toBe(false);
  });
});

describe('location and U.S. formatting', () => {
  it('hides manual state/ZIP only when the address resolved', () => {
    expect(locationResolved('FL', '33602')).toBe(true);
    expect(locationResolved('FL', '')).toBe(false);
    expect(locationResolved(undefined, '33602')).toBe(false);
  });
  it('displays MM/DD/YYYY and 12-hour time from canonical values', () => {
    expect(formatUsDate('2026-12-03')).toBe('12/03/2026');
    expect(formatUsTime('14:05')).toBe('2:05 PM');
    expect(formatUsTime('00:30')).toBe('12:30 AM');
  });
  it('estimates drop-off from route duration and never guesses', () => {
    expect(estimateDropoffTime('09:00', 1500)).toBe('09:25');
    expect(estimateDropoffTime('09:00', null)).toBeNull();
    expect(estimateDropoffTime('', 600)).toBeNull();
    expect(estimateDropoffTime('23:50', 1200)).toBeNull();
  });
});

describe('additional stops', () => {
  it('Add Stop is a left-aligned visible action that switches to multi-stop storage', () => {
    expect(form).toContain('flex flex-col items-start gap-2');
    expect(form).toContain('tripType:"multi_trip",roundTrip:false,additionalStops:[...f.additionalStops');
  });
  it('existing multi-stop trips still validate', () => {
    expect(rideRequestSchema.safeParse({ ...base, tripType: 'multi_trip', additionalStops: [{ address: '3 Elm St', city: 'Tampa', pickupTime: '10:00' }] }).success).toBe(true);
  });
});

describe('child care', () => {
  const kids = [{ firstName: 'Mia', age: 6, requirement: 'booster_seat' as const }];
  it('renders exactly one row per selected child, 1–5', () => {
    expect(resizeChildren([], 3)).toHaveLength(3);
    expect(resizeChildren(kids, 9)).toHaveLength(5);
    expect(resizeChildren(kids, 0)).toHaveLength(1);
    expect(resizeChildren([...kids, ...kids], 1)[0]?.firstName).toBe('Mia');
  });
  it('persists structured child rows and requires an age', () => {
    expect(rideRequestSchema.safeParse({ ...base, serviceLine: 'child_care', children: kids }).success).toBe(true);
    expect(rideRequestSchema.safeParse({ ...base, serviceLine: 'child_care', children: [] }).success).toBe(false);
    expect(rideRequestSchema.safeParse({ ...base, serviceLine: 'child_care', children: [{ ...kids[0], age: null }] }).success).toBe(false);
  });
  it('rejects child details on medical trips', () => {
    expect(rideRequestSchema.safeParse({ ...base, children: kids }).success).toBe(false);
  });
  it('uses wheelchair vehicles only when a child requires one', () => {
    expect(childCareTransport(kids)).toBe('ambulatory');
    expect(childCareTransport([{ ...kids[0]!, requirement: 'wheelchair' }])).toBe('wheelchair');
  });
  it('never invents a rate', () => {
    expect(childCarePricing('child_care')).toBe('review_required');
    expect(childCarePricing('medical')).toBe('standard');
    expect(readFileSync('src/components/portal/NewTripWorkspace.tsx', 'utf8')).toContain("'Pricing Review Required'");
  });
  it('network projections carry only a count, never names or ages', () => {
    expect(networkSafeChildCare({ version: 1, children: kids })).toEqual({ serviceLine: 'child_care', childCount: 1 });
    expect(readFileSync('src/lib/trip-network.functions.ts', 'utf8')).not.toContain('child_care_details');
  });
  it('copies, drafts and details carry child care through', () => {
    expect(readFileSync('src/lib/provider-trip-copy.functions.ts', 'utf8')).toContain('child_care_details');
    expect(readFileSync('src/lib/requests/request-service.server.ts', 'utf8')).toContain('child_care_details:');
    expect('serviceLine' in rideRequestSchema.shape && 'children' in rideRequestSchema.shape).toBe(true);
  });
});

describe('reservations', () => {
  it('places every row in exactly one section', () => {
    const rows = [{ id: 'a' }, { id: 'a' }, { id: 'b', source_workspace_id: 'w', network_distribution_id: 'd' }, { id: 'c', network_provider_workspace_id: 'w' }];
    const g = groupReservations(rows, 'w', 'u');
    expect([g.owned.length, g.sent.length, g.received.length]).toEqual([1, 1, 1]);
    expect(reservationCategory({ id: 'c', network_provider_workspace_id: 'w' }, 'w', 'u')).toBe('received');
  });
  it('active view is two columns; past/canceled/history are unified', () => {
    const trips = readFileSync('src/components/portal/ProviderTrips.tsx', 'utf8');
    expect(trips).toContain('lg:grid-cols-2');
    expect(trips).toContain('data-reservation-column="trips"');
    expect(trips).toContain('data-reservation-column="referrals"');
    expect(trips).not.toContain("(['owned','sent','received'] as const).map");
    expect(trips.match(/hideScheduling/g)?.length).toBeGreaterThanOrEqual(4);
  });
});

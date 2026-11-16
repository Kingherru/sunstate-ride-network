import { test, expect } from 'bun:test';
import { DEMO_TRIP_DRAFTS } from '../src/components/portal/demo-fixtures/trip-drafts';
import { restoreDraftFields } from '../src/lib/draft-fields';

test('passenger preview resume retains date, service, route, round trip and instructions', () => {
  const draft = DEMO_TRIP_DRAFTS[0];
  expect(draft?.payload.requestCategory).toBe('passenger');
  const restored = restoreDraftFields(draft?.payload ?? {}, ['pickupDate','transportType','pickupCity','dropoffCity','tripType','specialInstructions']);
  expect(restored).toEqual({pickupDate:'2026-11-20',transportType:'wheelchair',pickupCity:'Orlando',dropoffCity:'Winter Park',tripType:'round_trip',specialInstructions:'Preview only: wheelchair assistance at pickup.'});
});

test('Medical Delivery preview resume retains delivery category and handling instructions separately', () => {
  const draft = DEMO_TRIP_DRAFTS[1];
  expect(draft?.payload.requestCategory).toBe('medical_delivery');
  const restored = restoreDraftFields(draft?.payload ?? {}, ['deliveryCategory','deliveryInstructions','pickupDate','pickupTime']);
  expect(restored).toEqual({deliveryCategory:'medical_supplies',deliveryInstructions:'Preview only: keep sealed package upright.',pickupDate:'2026-11-20',pickupTime:'11:00'});
  expect(draft?.payload.patientFirstName).toBeUndefined();
});
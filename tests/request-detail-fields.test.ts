import { expect, it } from 'vitest';
import { detailValue, selectedService, selectedTripType } from '../src/lib/request-detail-fields';
it('distinguishes blank, inapplicable and unavailable fields', () => {
  expect(detailValue({ return_pickup_time: null }, 'return_pickup_time')).toBe('NOT PROVIDED');
  expect(detailValue({}, 'return_pickup_time', false)).toBe('NOT REQUIRED');
  expect(detailValue({}, 'return_pickup_time')).toBe('NOT AVAILABLE');
});
it('preserves multi-trip and selected repeating-trip identity', () => {
  expect(selectedTripType({ trip_type: 'multi_trip', round_trip: false })).toBe('MULTI-TRIP');
  expect(selectedTripType({ trip_type: 'round_trip', recurrence_rule: 'weekly' })).toBe('REPEATING TRIP');
  expect(selectedTripType({ trip_type: 'one_way' })).toBe('ONE WAY');
});
it('uses actual service including delivery and gurney', () => {
  expect(selectedService({ transport_type: 'gurney' })).toBe('GURNEY/STRETCHER');
  expect(selectedService({ trip_kind: 'medical_delivery', transport_type: 'delivery' })).toBe('MEDICAL DELIVERY');
  expect(selectedService({})).toBe('NOT AVAILABLE');
});
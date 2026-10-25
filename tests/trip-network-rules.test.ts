import { describe, expect, it } from 'vitest';
import { nextRadius, needsDistributionAttention, conflictingSlots, distributionInput } from '../src/lib/trip-network-rules';
describe('controlled distribution rules', () => {
  it('requires payment responsibility acknowledgement for provider trip sharing', () => {
    const input = { trip_id: '00000000-0000-4000-8000-000000000001', amount_cents: 10000, expires_at: '2026-11-01T12:00:00Z' };
    expect(distributionInput.safeParse(input).success).toBe(false);
    expect(distributionInput.safeParse({ ...input, payment_responsibility_confirmed: true }).success).toBe(true);
  });
  it('expands only through 20, 50, 100 and 200 miles', () => {
    expect([nextRadius(null), nextRadius(20), nextRadius(50), nextRadius(100), nextRadius(200)]).toEqual([20, 50, 100, 200, null]);
  });
  it('needs attention after exactly 24 hours without a selected provider', () => {
    const start = '2026-10-25T00:00:00Z';
    expect(needsDistributionAttention(start, false, Date.parse(start) + 86400000 - 1)).toBe(false);
    expect(needsDistributionAttention(start, false, Date.parse(start) + 86400000)).toBe(true);
    expect(needsDistributionAttention(start, true, Date.parse(start) + 86400000)).toBe(false);
  });
  it('flags overlapping driver or vehicle assignments using known trip times', () => {
    const rows = [
      { id: 'a', pickup_date: '2026-10-25', pickup_time: '10:00:00', estimated_duration_seconds: 3600, driver_id: 'd1', vehicle_id: 'v1' },
      { id: 'b', pickup_date: '2026-10-25', pickup_time: '10:30:00', estimated_duration_seconds: 1800, driver_id: 'd1', vehicle_id: 'v2' },
      { id: 'c', pickup_date: '2026-10-25', pickup_time: '10:15:00', estimated_duration_seconds: 1800, driver_id: 'd2', vehicle_id: 'v1' },
      { id: 'free', pickup_date: '2026-10-25', pickup_time: '12:00:00', driver_id: 'd1', vehicle_id: 'v1' },
    ];
    expect([...conflictingSlots(rows)].sort()).toEqual(['a', 'b', 'c']);
  });
});
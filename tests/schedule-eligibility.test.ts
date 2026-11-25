import { describe, it, expect } from 'vitest';
import { eligibleDrivers, eligibleVehicles, monthGrid, addMonths } from '../src/lib/schedule-eligibility';
const weekly = (start: string, end: string) => ({ mode: 'weekly', days: { '3': { start, end } } });
const trip = { id: 't', scheduled_start_time: '10:00', assignment_end_time: '11:00' };
describe('schedule eligibility', () => {
  it('excludes drivers outside shift', () => { expect(eligibleDrivers(trip, [{ id: 'a', status: 'active', availability: weekly('12:00', '18:00') }], [], '2026-11-25', 3)).toEqual([]); });
  it('excludes drivers on time off', () => { expect(eligibleDrivers(trip, [{ id: 'a', status: 'active', vacation_start: '2026-11-20', vacation_end: '2026-11-30' }], [], '2026-11-25', 3)).toEqual([]); });
  it('excludes overlapping bookings but allows back-to-back', () => {
    const d = [{ id: 'a', status: 'active' }];
    expect(eligibleDrivers(trip, d, [{ id: 'o', assigned_driver_id: 'a', scheduled_start_time: '10:30' }], '2026-11-25', 3)).toEqual([]);
    expect(eligibleDrivers(trip, d, [{ id: 'o', assigned_driver_id: 'a', scheduled_start_time: '11:00' }], '2026-11-25', 3)).toHaveLength(1);
  });
  it('excludes inactive and busy vehicles', () => { expect(eligibleVehicles(trip, [{ id: 'v', status: 'inactive' }, { id: 'w', status: 'active' }, { id: 'x', status: 'active' }], [{ id: 'o', vehicle_id: 'x', scheduled_start_time: '10:15' }]).map(v => v.id)).toEqual(['w']); });
  it('builds month grid and clamps month moves', () => { expect(monthGrid('2026-11-25').filter(Boolean)).toHaveLength(30); expect(addMonths('2026-01-31', 1)).toBe('2026-02-28'); });
});

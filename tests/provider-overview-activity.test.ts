import { describe, it, expect } from 'vitest';
import { overviewMessageCount, overviewNotificationCounts } from '../src/components/portal/provider-overview-activity';
import type { NotificationRow } from '../src/lib/notifications.functions';

const notice = (id: string, type: string, extra: Partial<NotificationRow> = {}): NotificationRow => ({ id, type, title: 'Update', body: null, link: null, ride_request_id: null, read_at: null, created_at: '2026-11-20T00:00:00Z', ...extra });
describe('Provider Overview authorized activity projection', () => {
  it('combines only the two existing provider messaging counts', () => {
    expect(overviewMessageCount(3, 4)).toBe(7);
    expect(overviewMessageCount([], undefined)).toBe(0);
    expect(overviewMessageCount(-1, NaN)).toBe(0);
  });
  it('counts unread incoming trips and referrals, not unrelated network or payment events', () => {
    expect(overviewNotificationCounts([notice('1', 'referral_received'), notice('2', 'trip_received'), notice('3', 'network_update'), notice('4', 'payment_failed')])).toEqual({ newTrips: 2, schedule: 0 });
  });
  it('uses authorized schedule destinations and assignment types, never descriptive text', () => {
    expect(overviewNotificationCounts([notice('1', 'update', { link: '/portal/schedule?day=today' }), notice('2', 'driver_assigned'), notice('3', 'assignment_changed'), notice('4', 'news', { title: 'Schedule assignment', body: 'new_trip' })])).toEqual({ schedule: 3, newTrips: 0 });
  });
  it('clears counts only when the supplied existing read state changes', () => {
    const rows = [notice('1', 'referral_received'), notice('2', 'driver_assigned')];
    expect(overviewNotificationCounts(rows)).toEqual({ newTrips: 1, schedule: 1 });
    expect(overviewNotificationCounts(rows)).toEqual({ newTrips: 1, schedule: 1 });
    expect(rows.every(row => row.read_at === null)).toBe(true);
    expect(overviewNotificationCounts(rows.map(row => ({ ...row, read_at: '2026-11-20T01:00:00Z' })))).toEqual({ newTrips: 0, schedule: 0 });
  });
  it('deduplicates notification identities and avoids matching other destinations', () => {
    const row = notice('1', 'referral_received');
    expect(overviewNotificationCounts([row, row, notice('2', 'update', { link: '/portal/schedule-other' })])).toEqual({ newTrips: 1, schedule: 0 });
  });
});
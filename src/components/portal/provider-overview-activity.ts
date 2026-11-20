import type { NotificationRow } from '@/lib/notifications.functions';

/** Only already-authorized unread notices may contribute; never classify body text. */
export function overviewNotificationCounts(rows: readonly NotificationRow[]) {
  const ids = new Set<string>();
  let schedule = 0;
  let newTrips = 0;
  for (const row of rows) {
    if (row.read_at != null || ids.has(row.id)) continue;
    ids.add(row.id);
    const path = row.link?.split(/[?#]/)[0];
    if (path === '/portal/schedule' || /^(schedule|assignment|driver_assigned|vehicle_assigned)(_|$)/.test(row.type)) {
      schedule++;
    } else if (row.type === 'referral_received' || row.type === 'trip_received' || row.type === 'new_trip') {
      newTrips++;
    }
  }
  return { schedule, newTrips };
}

export function overviewMessageCount(workspace: unknown, direct: unknown): number {
  const safeCount = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : 0;
  return safeCount(workspace) + safeCount(direct);
}
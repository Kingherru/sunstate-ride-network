/** Business rules shared by controlled distribution and its narrow tests. */
import { z } from 'zod';
export const PAYMENT_RESPONSIBILITY_WARNING = 'Warning: You are responsible for paying for trips you send to other providers. Failure to pay may result in the loss of your verification status, account suspension, or removal from the platform.';
export const distributionInput = z.object({ request_id: z.string().uuid().optional(), trip_id: z.string().uuid().optional(), amount_cents: z.number().int().positive(), expires_at: z.string().datetime(), payment_responsibility_confirmed: z.boolean().optional() }).refine(i => !!i.request_id !== !!i.trip_id).refine(i => !i.trip_id || i.payment_responsibility_confirmed === true, 'Confirm payment responsibility before sharing a trip.');
export const DISTRIBUTION_RADII = [20, 50, 100, 200] as const;
export const ATTENTION_AFTER_HOURS = 24;
export function nextRadius(current: number | null): number | null {
  return DISTRIBUTION_RADII.find((radius) => radius > (current ?? 0)) ?? null;
}
export function needsDistributionAttention(createdAt: string, selected: boolean, now = Date.now()) {
  return !selected && now - Date.parse(createdAt) >= ATTENTION_AFTER_HOURS * 60 * 60 * 1000;
}
export type ScheduleSlot = { id: string; pickup_date: string; pickup_time?: string | null; scheduled_start_time?: string | null; estimated_duration_seconds?: number | null; estimated_pickup_at?: string | null; estimated_dropoff_at?: string | null; driver_id?: string | null; assigned_driver_id?: string | null; vehicle_id?: string | null };
export function conflictingSlots(rows: ScheduleSlot[]): Set<string> {
  const conflicts = new Set<string>();
  const interval = (r: ScheduleSlot) => {
    const start = Date.parse(r.estimated_pickup_at || `${r.pickup_date}T${r.scheduled_start_time || r.pickup_time || '00:00:00'}`);
    const end = r.estimated_dropoff_at ? Date.parse(r.estimated_dropoff_at) : r.estimated_duration_seconds ? start + r.estimated_duration_seconds * 1000 : start;
    return { start, end };
  };
  rows.forEach((a, i) => rows.slice(i + 1).forEach((b) => {
    const x = interval(a), y = interval(b);
    const driverA = a.driver_id || a.assigned_driver_id, driverB = b.driver_id || b.assigned_driver_id;
    const resource = (driverA && driverA === driverB) || (a.vehicle_id && a.vehicle_id === b.vehicle_id) || a.id === b.id;
    const overlaps = x.start === y.start || (x.start < y.end && y.start < x.end);
    if (resource && overlaps) { conflicts.add(a.id); conflicts.add(b.id); }
  }));
  return conflicts;
}
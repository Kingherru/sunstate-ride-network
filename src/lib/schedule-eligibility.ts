/** Pure schedule eligibility rules. The assignment RPC stays the authority; this only narrows what the board offers. */
export type EligDriver = { id: string; status?: string | null; vacation_start?: string | null; vacation_end?: string | null; availability?: unknown };
export type EligTrip = { id: string; assigned_driver_id?: string | null; vehicle_id?: string | null; scheduled_start_time?: string | null; pickup_time?: string | null; assignment_end_time?: string | null };
export type EligVehicle = { id: string; status?: string | null };

const toMin = (t: string | null | undefined) => { const m = /^(\d{1,2}):(\d{2})/.exec(String(t ?? '')); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
/** Trip window in minutes; trips without an end hold one hour. */
export function tripWindow(t: EligTrip): [number, number] | null {
  const s = toMin(t.scheduled_start_time ?? t.pickup_time); if (s === null) return null;
  const e = toMin(t.assignment_end_time); return [s, e !== null && e > s ? e : s + 60];
}
const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] && b[0] < a[1];

export function onTimeOff(d: EligDriver, iso: string) {
  if (!d.vacation_start || !d.vacation_end) return false;
  return iso >= String(d.vacation_start).slice(0, 10) && iso <= String(d.vacation_end).slice(0, 10);
}
/** Weekly shift covers the whole trip window; flexible drivers are always on shift. */
export function onShift(d: EligDriver, dow: number, win: [number, number]) {
  const a = d.availability as { mode?: string; days?: Record<string, { off?: boolean; start?: string; end?: string }> } | null | undefined;
  if (!a || typeof a !== 'object' || a.mode !== 'weekly') return true;
  const day = a.days?.[String(dow)]; if (!day || day.off) return false;
  const s = toMin(day.start ?? '09:00') ?? 0, e = toMin(day.end ?? '17:00') ?? 0;
  return win[0] >= s && win[1] <= e;
}
export function busy(id: string, key: 'assigned_driver_id' | 'vehicle_id', trip: EligTrip, trips: EligTrip[]) {
  const w = tripWindow(trip); if (!w) return false;
  return trips.some(o => o.id !== trip.id && o[key] === id && (() => { const ow = tripWindow(o); return !!ow && overlaps(w, ow); })());
}
export function eligibleDrivers<D extends EligDriver>(trip: EligTrip, drivers: D[], trips: EligTrip[], iso: string, dow: number): D[] {
  const w = tripWindow(trip); if (!w) return [];
  return drivers.filter(d => d.status === 'active' && !onTimeOff(d, iso) && onShift(d, dow, w) && !busy(d.id, 'assigned_driver_id', trip, trips));
}
export function eligibleVehicles<V extends EligVehicle>(trip: EligTrip, vehicles: V[], trips: EligTrip[]): V[] {
  return vehicles.filter(v => v.status === 'active' && !busy(v.id, 'vehicle_id', trip, trips));
}
/** Month grid of ISO dates (Sunday first, leading/trailing blanks as null). */
export function monthGrid(iso: string): (string | null)[] {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay(), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const out: (string | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) out.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (out.length % 7) out.push(null);
  return out;
}
export function addMonths(iso: string, delta: number) {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1 + delta, 1)); const max = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, max)).padStart(2, '0')}`;
}

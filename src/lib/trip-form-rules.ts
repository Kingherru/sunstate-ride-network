/** Pure rules for the shared trip request form (provider + public). */
export const PROVIDER_FORM_SECTIONS = ['Trip Type','Transportation Type','Passenger Information','Pickup','Pickup Options','Drop-Off','Additional Stops','Mobility Requirements','Mobility / Special Instructions','Billing','Live Invoice'] as const;
export const ADDITIONAL_PASSENGER_CHOICES = [0,1,2,3,4,5] as const;
export const CHILD_COUNT_CHOICES = [1,2,3,4,5] as const;
export const CHILD_REQUIREMENTS = ['car_seat','booster_seat','wheelchair','standard_seat'] as const;
export type ChildRequirement = typeof CHILD_REQUIREMENTS[number];
export const CHILD_REQUIREMENT_LABELS: Record<ChildRequirement,string> = {car_seat:'Car Seat',booster_seat:'Booster Seat',wheelchair:'Wheelchair',standard_seat:'Standard Seat'};
export type ChildRow = {firstName:string;age:number|null;requirement:ChildRequirement};
export const blankChild = (): ChildRow => ({firstName:'',age:null,requirement:'standard_seat'});
/** Exactly `count` rows, keeping existing entries. */
export function resizeChildren(rows: readonly ChildRow[], count: number): ChildRow[] {
  const n = Math.min(5, Math.max(1, Math.floor(count)));
  return Array.from({length:n},(_,i)=>rows[i] ?? blankChild());
}
/** Authoritative total = primary rider (or each child) + additional passengers. */
export function totalPassengers(additional: number, childCount = 0): number {
  return Math.max(1, childCount) + Math.min(5, Math.max(0, Math.floor(additional)));
}
export function additionalFromTotal(total: number | null | undefined, childCount = 0): number {
  return Math.min(5, Math.max(0, (total ?? 1) - Math.max(1, childCount)));
}
/** Child care vehicle need maps to the existing transport categories. */
export function childCareTransport(rows: readonly ChildRow[]): 'ambulatory'|'wheelchair' {
  return rows.some(r=>r.requirement==='wheelchair') ? 'wheelchair' : 'ambulatory';
}
/** Child Care never reuses medical rates; it always needs provider review. */
export function childCarePricing(serviceLine: string | null | undefined): 'review_required' | 'standard' {
  return serviceLine === 'child_care' ? 'review_required' : 'standard';
}
export function locationResolved(state?: string | null, zip?: string | null): boolean {
  return !!state && /^\d{5}(-\d{4})?$/.test(zip ?? '');
}
export function formatUsDate(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[2]}/${m[3]}/${m[1]}` : '';
}
export function formatUsTime(hhmm?: string | null): string {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
/** Pickup time + route duration; null when inputs are missing or the arrival crosses midnight (review required). */
export function estimateDropoffTime(pickupTime: string | null | undefined, durationSeconds: number | null | undefined): string | null {
  const m = /^(\d{2}):(\d{2})$/.exec(pickupTime ?? '');
  if (!m || durationSeconds == null || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return null;
  const total = Number(m[1]) * 60 + Number(m[2]) + Math.ceil(durationSeconds / 60);
  if (total >= 24 * 60) return null;
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`;
}
/** Network/general projections must never carry child identity. */
export function networkSafeChildCare(details: unknown): {serviceLine:'child_care';childCount:number} | null {
  const rows = details && typeof details === 'object' && Array.isArray((details as {children?:unknown}).children) ? (details as {children:unknown[]}).children : null;
  return rows ? {serviceLine:'child_care',childCount:rows.length} : null;
}

/* ---------- Compact 12-hour time control (canonical HH:MM stays stored) ---------- */
export type TimeParts = { hour: number; tens: number; ones: number; period: 'AM' | 'PM' };
export function timeParts(hhmm?: string | null): TimeParts | null {
  const m = /^(\d{2}):(\d{2})/.exec(hhmm ?? '');
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return { hour: h % 12 || 12, tens: Math.floor(min / 10), ones: min % 10, period: h < 12 ? 'AM' : 'PM' };
}
export function canonicalTime(p: TimeParts): string {
  if (p.hour < 1 || p.hour > 12 || p.tens < 0 || p.tens > 5 || p.ones < 0 || p.ones > 9) throw new Error('Invalid time');
  const h = (p.hour % 12) + (p.period === 'PM' ? 12 : 0);
  return `${String(h).padStart(2, '0')}:${p.tens}${p.ones}`;
}

/* ---------- Chronology ---------- */
const mins = (t?: string | null) => { const m = /^(\d{2}):(\d{2})/.exec(t ?? ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
type ChronoForm = { tripType?: string; pickupDate?: string; pickupTime?: string; appointmentTime?: string | null; returnDate?: string | null; returnPickupTime?: string | null; additionalStops?: readonly { date?: string | null; pickupTime?: string | null }[] };
/** Inline + submit validation; keys match form error paths. Nothing is discarded. */
export function tripChronologyErrors(f: ChronoForm): Record<string, string> {
  const errors: Record<string, string> = {};
  const pickup = mins(f.pickupTime), appt = mins(f.appointmentTime);
  if (pickup != null && appt != null && appt <= pickup) errors.appointmentTime = 'Appointment Time must be later than the Pickup Time.';
  if (f.tripType === 'round_trip') {
    const ret = mins(f.returnPickupTime);
    const sameDay = !f.returnDate || f.returnDate === f.pickupDate;
    if (f.returnDate && f.pickupDate && f.returnDate < f.pickupDate) errors.returnPickupTime = 'Return date cannot be before the pickup date.';
    else if (sameDay && ret != null && appt != null && ret < appt + 5) errors.returnPickupTime = 'Return Pickup Time must be at least 5 minutes after the Appointment Time.';
    else if (sameDay && ret != null && appt == null && pickup != null && ret <= pickup) errors.returnPickupTime = 'Return Pickup Time must be later than the Pickup Time.';
  }
  if (f.tripType === 'multi_trip') {
    let prevDate = f.pickupDate ?? '', prevTime = pickup;
    (f.additionalStops ?? []).forEach((s, i) => {
      const date = s.date || f.pickupDate || '';
      const t = mins(s.pickupTime);
      if (date && prevDate && date < prevDate) errors[`additionalStops.${i}.pickupTime`] = `Leg ${i + 2} date cannot be before the preceding leg.`;
      else if (date === prevDate && t != null && prevTime != null && t <= prevTime) errors[`additionalStops.${i}.pickupTime`] = `Leg ${i + 2} time must be later than the preceding leg on the same date.`;
      if (t != null) { prevDate = date; prevTime = t; } else if (date !== prevDate) { prevDate = date; prevTime = null; }
    });
  }
  return errors;
}

/* ---------- Route segments ---------- */
type RoutableForm = { tripType?: string; pickupAddress?: string; pickupCity?: string; pickupState?: string | null; pickupZip?: string | null; dropoffAddress?: string; dropoffCity?: string; dropoffState?: string | null; dropoffZip?: string | null; additionalStops?: readonly { address?: string; city?: string; state?: string | null; zip?: string | null }[] };
const addr = (a?: string, c?: string, s?: string | null, z?: string | null) => (a ?? '').trim().length >= 3 && (c ?? '').trim() ? [a, c, s, z].filter(Boolean).join(', ') : null;
/** Ordered stops for mileage: one way A→B, round trip A→B→A, multi trip A→legs…→B. Null when any point is incomplete. */
export function routePoints(f: RoutableForm): string[] | null {
  const a = addr(f.pickupAddress, f.pickupCity, f.pickupState, f.pickupZip), b = addr(f.dropoffAddress, f.dropoffCity, f.dropoffState, f.dropoffZip);
  if (!a || !b) return null;
  if (f.tripType === 'round_trip') return [a, b, a];
  if (f.tripType === 'multi_trip') {
    const legs = (f.additionalStops ?? []).map(s => addr(s.address, s.city, s.state, s.zip));
    if (legs.some(l => !l)) return null;
    return [a, ...(legs as string[]), b];
  }
  return [a, b];
}
/** Sum every segment; one missing segment means review required (never invented). */
export function sumRouteMiles(segments: readonly (number | null | undefined)[]): number | null {
  if (!segments.length || segments.some(s => s == null || !Number.isFinite(s) || s < 0)) return null;
  return Math.round(segments.reduce<number>((t, s) => t + (s as number), 0) * 10) / 10;
}
export const TRIP_TYPE_DISPLAY: Record<string, string> = { one_way: 'One Way', round_trip: 'Round Trip', multi_trip: 'Multi Trip' };

/* ---------- Compact list presentation ---------- */
/** Privacy-conscious partial address: city (and state) only, never street numbers. */
export function partialAddress(city?: string | null, street?: string | null, state?: string | null): string {
  if (city?.trim()) return [city.trim(), state?.trim()].filter(Boolean).join(', ');
  const s = (street ?? '').replace(/^\s*\d+[\w-]*\s+/, '').trim();
  return s ? `${s} area` : 'Location on file';
}
/** Combined Drafts/Unconfirmed badge: presentation only, status is unchanged. */
export function pendingBadge(item: { kind: 'draft' } | { kind: 'trip'; requester_user_id?: string | null; created_by?: string | null }, userId: string): 'Draft' | 'Unconfirmed' | 'Patient Request · Unconfirmed' {
  if (item.kind === 'draft') return 'Draft';
  const requester = item.requester_user_id ?? item.created_by;
  return requester && requester !== userId ? 'Patient Request · Unconfirmed' : 'Unconfirmed';
}
/** Two separate truthful facts: direction, and read state only when a watermark exists. */
export function referralBadges(r: { direction: 'sent' | 'received'; unread?: boolean | null; status?: string | null }): string[] {
  const out: string[] = [r.direction === 'sent' ? 'Sent' : 'Received'];
  if (r.unread === true) out.push('Unread');
  else if (r.unread === false) out.push('Read');
  if (r.status && ['pending', 'revised', 'countered', 'ready', 'offers_sent', 'negotiating'].includes(r.status)) out.push('Unconfirmed');
  return out;
}
/** Canceled trips remain in History, identified by status. */
export const HISTORY_CANCELED_STATUSES = ['canceled', 'cancelled', 'declined', 'expired'] as const;
export const isCanceledStatus = (s?: string | null) => (HISTORY_CANCELED_STATUSES as readonly string[]).includes((s ?? '').toLowerCase());

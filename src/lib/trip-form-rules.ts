/** Pure rules for the shared trip request form (provider + public). */
export const PROVIDER_FORM_SECTIONS = ['Trip Type','Transportation Type','Passenger Information','Pickup','Drop-Off','Additional Stops','Mobility Requirements','Mobility / Special Instructions','Billing','Live Invoice'] as const;
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

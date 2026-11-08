import { patientStage } from './patient-timeline';

export const COMMUNICATION_TEMPLATE_VERSION = 'customer-update-2026-11-08';
export const DELIVERY_ENABLED = false;
export const CUSTOMER_STATES = ['Pending', 'Waiting on Payment', 'Approved', 'Added to Dispatch Schedule', 'Completed', 'Canceled'] as const;
export type CommunicationState = 'prepared' | 'suppressed' | 'queued' | 'sent' | 'delivered' | 'failed' | 'canceled' | 'not_configured';
export type CommunicationEvidence = {
  reference: string; workspaceId: string; recipientId: string; tripId: string | null; requestId: string;
  invoiceId?: string; category: string; templateVersion: string; channel: 'email' | 'in_app';
  state: CommunicationState; reason: string; dedupeKey: string; version: string;
  scheduledAt: string | null; timezone: string | null; policyBasis: string; deliveryEnabled: false;
};
export function customerCommunicationStatus(status: string, invoiceDue = false) {
  const known = ['pending','received','new','approved','confirmed','accepted','reserved','assigned','in_progress','scheduled','dispatched','driver_assigned','completed','canceled','cancelled'];
  if (!known.includes(status.toLowerCase())) return null;
  const stage = patientStage(status, invoiceDue);
  return stage === 'Driver Assigned' ? 'Added to Dispatch Schedule' : stage;
}
export function communicationKey(recipient: string, trip: string, category: string, version: string, channel: string) {
  return JSON.stringify([recipient, trip, category, version, channel]);
}
export function deliveryDecision(required: boolean, preference: boolean | undefined, configured = false) {
  if (!required && preference === false) return { state: 'suppressed' as const, reason: 'optional_preference_disabled' };
  return { state: configured ? 'prepared' as const : 'not_configured' as const, reason: 'delivery_off' };
}
export type ReminderInput = { tripId: string; recipientId: string; version: string; status: string; passenger: boolean; authorized: boolean; confirmedEmail: boolean; activeRelationship: boolean; communicationPermission: boolean; pickupDate: string | null; pickupTime: string | null; timezone: string | null; now: number; timingApproved?: boolean };
function zonedParts(epoch: number, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(epoch);
  const part = (name: string) => Number(parts.find(p => p.type === name)?.value);
  return [part('year'), part('month'), part('day'), part('hour'), part('minute')];
}
/** Reject DST gaps and ambiguous folds instead of selecting an arbitrary offset. */
export function resolveLocalPickup(date: string, time: string, timezone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time) || !timezone.includes('/')) return null;
  const [year, month, day] = date.split('-').map(Number), [hour, minute] = time.split(':').map(Number);
  if (hour > 23 || minute > 59) return null;
  const target = [year, month, day, hour, minute];
  const nominal = Date.UTC(year, month - 1, day, hour, minute);
  const matches = new Set<number>();
  try {
    const offsets = new Set<number>();
    for (const delta of [-86400000, 0, 86400000]) {
      const sample = nominal + delta, p = zonedParts(sample, timezone);
      offsets.add(Date.UTC(p[0], p[1] - 1, p[2], p[3], p[4]) - sample);
    }
    for (const offset of offsets) { const candidate = nominal - offset; if (zonedParts(candidate, timezone).every((p, i) => p === target[i])) matches.add(candidate); }
  } catch { return null; }
  return matches.size === 1 ? [...matches][0] ?? null : null;
}
export function prepareReminders(input: ReminderInput) {
  const types = ['day_before', 'day_of'] as const;
  let reason = '';
  if (!input.authorized || !input.activeRelationship || !input.communicationPermission) reason = 'recipient_not_authorized';
  else if (!input.confirmedEmail) reason = 'confirmed_email_required';
  else if (!input.passenger || !['approved','confirmed','accepted','reserved','assigned','scheduled','dispatched','in_progress'].includes(input.status)) reason = 'trip_not_eligible';
  else if (!input.timezone) reason = 'timezone_required';
  else if (!input.timingApproved) reason = 'reminder_timing_not_configured';
  else if (!input.pickupDate || !input.pickupTime) reason = 'pickup_datetime_required';
  const pickup = !reason && input.pickupDate && input.pickupTime && input.timezone ? resolveLocalPickup(input.pickupDate, input.pickupTime, input.timezone) : null;
  if (!reason && pickup === null) reason = 'timezone_or_pickup_ambiguous';
  if (!reason && pickup !== null && pickup <= input.now) reason = 'pickup_not_future';
  return types.map(type => {
    // No owner-approved wall-clock reminder time exists yet. Day-before uses
    // the same local pickup time on the previous calendar day; day-of is at
    // pickup time, explicitly preview-only pending owner timing approval.
    let scheduled = pickup;
    if (!reason && type === 'day_before' && input.pickupDate && input.pickupTime && input.timezone) {
      const previous = new Date(`${input.pickupDate}T12:00:00Z`); previous.setUTCDate(previous.getUTCDate() - 1);
      scheduled = resolveLocalPickup(previous.toISOString().slice(0, 10), input.pickupTime, input.timezone);
    }
    const suppressed = reason || (scheduled === null ? 'timezone_or_pickup_ambiguous' : scheduled <= input.now ? 'reminder_time_in_past' : '');
    return { type, scheduledAt: suppressed || scheduled === null ? null : new Date(scheduled).toISOString(), timezone: input.timezone, state: suppressed ? 'suppressed' as const : 'prepared' as const, reason: suppressed || 'delivery_off', dedupeKey: communicationKey(input.recipientId, input.tripId, type, input.version, 'email'), version: input.version, deliveryEnabled: false as const };
  });
}
export function supersededUnsent<T extends { version: string; state: CommunicationState; scheduledAt: string | null }>(events: T[], version: string, canceled: boolean) {
  return events.filter(e => !['sent','delivered','canceled'].includes(e.state) && (canceled || e.version !== version));
}
export function safeCustomerContact(input: { assigned: boolean; withheld: boolean; shareName: boolean; sharePhone: boolean; providerConfirmed: boolean; driverConfirmed: boolean; assignmentMatches: boolean; driverName?: string | null; driverPhone?: string | null }) {
  return { driverName: input.assigned && !input.withheld && input.shareName ? input.driverName ?? null : null, driverPhone: input.assigned && !input.withheld && input.sharePhone && input.providerConfirmed && input.driverConfirmed && input.assignmentMatches ? input.driverPhone ?? null : null, driverLabel: 'Driver' };
}
export function invoiceTokenBindingValid(binding: { scope: string; environment: string | null; customerWorkspaceId: string | null; providerWorkspaceId: string | null; invoiceVersion: string | null; revokedAt: string | null; expiresAt: string }, invoice: { customerWorkspaceId: string | null; providerWorkspaceId: string; version: string }, environment: string, now: number) {
  return binding.scope === 'view' && binding.environment === environment && !!binding.customerWorkspaceId && binding.customerWorkspaceId === invoice.customerWorkspaceId && binding.providerWorkspaceId === invoice.providerWorkspaceId && binding.invoiceVersion === invoice.version && !binding.revokedAt && Date.parse(binding.expiresAt) > now;
}
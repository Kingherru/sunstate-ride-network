export type NotificationTone = 'red' | 'yellow' | 'green' | 'blue';
export function notificationTone(type: string): NotificationTone {
  const t = type.toLowerCase();
  if (/(fail|denied|urgent|expired|error|critical|reject)/.test(t)) return 'red';
  if (/(pending|review|warning|precaution|action_needed|attention|missing|reminder)/.test(t)) return 'yellow';
  if (/(accepted|approved|completed|success|paid)/.test(t)) return 'green';
  return 'blue';
}
export function unreadAfter(createdAt: string, readAt: string | null | undefined) {
  return !readAt || Date.parse(createdAt) > Date.parse(readAt);
}
export const DEFAULT_COLUMNS = [34, 33, 33];
export function resizeColumns(columns: number[], boundary: number, delta: number) {
  const next = [...columns];
  if (boundary !== 0 && boundary !== 1) return next;
  const shift = Math.max(20 - next[boundary], Math.min(60 - next[boundary], delta, next[boundary + 1] - 20));
  const bounded = Math.max(shift, next[boundary + 1] - 60);
  next[boundary] += bounded; next[boundary + 1] -= bounded;
  return next;
}
export function displayPhone(value: string) {
  const digits = value.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
  return digits.length === 10 ? `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}` : value;
}
export function payoutBucket(row: { state: string; paid_out: boolean; transferred: boolean; payment_succeeded_at: string | null; dispute_opened_at: string | null; dispute_resolved_at: string | null; refunded_at?: string | null; attempt_status?: string | null }) {
  if (row.refunded_at || row.state === 'refunded' || row.state === 'failed' || row.state === 'canceled' || (row.dispute_opened_at && !row.dispute_resolved_at) || ['failed','disputed','refunded','reversed','pending_policy_review'].includes(row.attempt_status??'')) return 'frozen';
  if (row.paid_out) return 'paid';
  if (row.state === 'available_for_transfer' && row.payment_succeeded_at && !row.transferred) return 'available';
  if (row.payment_succeeded_at && !row.transferred) return 'held';
  return 'pending';
}
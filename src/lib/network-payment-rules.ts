import { z } from 'zod';
import { isTimelyNetworkDispute } from './account-settings-rules';

export const NETWORK_PAYMENT_TIMEZONE = 'America/New_York';
const partsFormatter = new Intl.DateTimeFormat('en-US', { timeZone: NETWORK_PAYMENT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
function localParts(timestamp: number) {
  return Object.fromEntries(partsFormatter.formatToParts(timestamp).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
/** Three subsequent weekdays at the same New York local time; weekends excluded.
 * Holiday exclusions need an approved calendar and are not guessed.
 */
export function networkPaymentDeadline(completedAt: number): number {
  if (!Number.isFinite(completedAt)) throw new Error('Valid completion timestamp required.');
  const p = localParts(completedAt);
  const local = new Date(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, new Date(completedAt).getUTCMilliseconds()));
  let days = 0;
  while (days < 3) { local.setUTCDate(local.getUTCDate() + 1); if (![0, 6].includes(local.getUTCDay())) days++; }
  let utc = local.getTime();
  for (let i = 0; i < 4; i++) {
    const q = localParts(utc);
    const offset = Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second) - (utc - new Date(utc).getUTCMilliseconds());
    utc = local.getTime() - offset;
  }
  return utc;
}
export function pausedPaymentDeadline(dueAt: number, openedAt: number, resolvedAt: number) {
  if (![dueAt, openedAt, resolvedAt].every(Number.isFinite) || resolvedAt < openedAt) throw new Error('Valid dispute timestamps required.');
  return dueAt + resolvedAt - openedAt;
}
export type NetworkPaymentState = 'pending' | 'due' | 'processing' | 'paid' | 'overdue' | 'disputed' | 'resolved' | 'failed' | 'refunded';
export const NETWORK_PAYMENT_LABELS: Record<NetworkPaymentState, string> = { pending: 'Payment Pending', due: 'Payment Due', processing: 'Payment Processing', paid: 'Paid', overdue: 'Overdue', disputed: 'Disputed', resolved: 'Resolved', failed: 'Failed', refunded: 'Refunded' };
export function effectiveNetworkPaymentState(e: { state: NetworkPaymentState; dueAt: number | null; initiatedAt: number | null; activeDispute: boolean }, now: number): NetworkPaymentState {
  if (e.activeDispute) return 'disputed';
  if (['paid', 'refunded'].includes(e.state)) return e.state;
  if (e.initiatedAt !== null && !['failed','overdue'].includes(e.state)) return 'processing';
  if (e.dueAt !== null && now > e.dueAt) return 'overdue';
  return e.state;
}
export const networkDisputeInput = z.object({ distributionId: z.string().uuid(), reason: z.enum(['completion_missing','service_not_completed','amount_incorrect','security_issue']), confirmed: z.literal(true) }).strict();
export { isTimelyNetworkDispute };
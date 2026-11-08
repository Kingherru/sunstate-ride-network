/** Pass 3O-A settlement rules. Server/database computes amounts; these helpers only label and explain. */
export const NETWORK_FEE_BPS = 200; // 2% MY FLORIDA NEMT Network fee, paid by the sender
export const PROCESSING_FEE_RULE = 'disclosed_before_payment' as const;
export const PROCESSING_FEE_COPY = 'Payment-processing fee is paid by the sending provider and is shown itemized before payment is confirmed. It is never added after confirmation.';
export const REVIEW_WINDOW_HOURS = 24;
export const HOLD_DAYS = { super: 4, standard: 10 } as const;
/** Display only; the database helper network_receiver_hold_tier is canonical (automatic level 'gold' = Super Verified). */
export const holdDaysForTier = (tier: string | null | undefined) => (tier === 'super_verified' ? HOLD_DAYS.super : HOLD_DAYS.standard);
export const TIER_LABELS: Record<string, string> = { super_verified: 'Super Verified', blue: 'Verified', semi: 'Semi-Verified', none: 'Not verified' };
export const networkFeeCents = (payoutCents: number) => Math.round((payoutCents * NETWORK_FEE_BPS) / 10000);

export type SettlementState = 'pending_completion' | 'under_review' | 'payment_due' | 'overdue' | 'held' | 'available_for_transfer' | 'transferred' | 'payout_pending' | 'paid_out' | 'disputed' | 'refunded' | 'failed' | 'canceled';
export const SETTLEMENT_LABELS: Record<SettlementState, string> = {
  pending_completion: 'Pending', under_review: 'Under Review', payment_due: 'Payment Due', overdue: 'Overdue', held: 'Paid / Held',
  available_for_transfer: 'Available for Transfer', transferred: 'Transferred', payout_pending: 'Payout Pending', paid_out: 'Paid Out',
  disputed: 'Disputed', refunded: 'Refunded', failed: 'Failed', canceled: 'Canceled',
};
export const ALERT_STATES: SettlementState[] = ['overdue', 'disputed', 'failed'];

export type SettlementTimes = { state: string; review_window_ends_at: string | null; payment_deadline_at: string | null; release_eligible_at: string | null; transferred: boolean; paid_out: boolean };
/** Time-derived display state; no scheduler needed to show Payment Due / Overdue / Available. */
export function effectiveSettlementState(s: SettlementTimes, now = Date.now()): SettlementState {
  if (['disputed', 'refunded', 'failed', 'canceled'].includes(s.state)) return s.state as SettlementState;
  if (s.paid_out) return 'paid_out';
  if (s.transferred) return 'payout_pending';
  // Elapsed time alone is not authoritative release evidence. Database must mark availability.
  if (s.state === 'held') return 'held';
  if (s.state === 'available_for_transfer') return 'available_for_transfer';
  if (s.state === 'under_review') {
    if (s.review_window_ends_at && now < Date.parse(s.review_window_ends_at)) return 'under_review';
    return s.payment_deadline_at && now > Date.parse(s.payment_deadline_at) ? 'overdue' : 'payment_due';
  }
  return 'pending_completion';
}

export type ConnectState = 'not_started' | 'information_required' | 'pending' | 'enabled' | 'restricted' | 'disabled';
export const CONNECT_LABELS: Record<ConnectState, string> = { not_started: 'Not Started', information_required: 'Information Required', pending: 'Pending', enabled: 'Enabled', restricted: 'Restricted', disabled: 'Disabled' };
export function connectState(a: { status?: string | null; payouts_enabled?: boolean | null; details_submitted?: boolean | null; requirements_due?: unknown } | null): ConnectState {
  if (!a || !a.status || a.status === 'not_connected') return 'not_started';
  if (a.status === 'disabled') return 'disabled';
  if (a.status === 'restricted') return 'restricted';
  if (a.payouts_enabled) return 'enabled';
  const due = Array.isArray(a.requirements_due) ? a.requirements_due.length : 0;
  return !a.details_submitted || due > 0 ? 'information_required' : 'pending';
}

/** Connect webhook events Pass 3O-B must subscribe to (not enabled in this pass). */
export const PASS_3OB_CONNECT_EVENTS = ['account.updated', 'payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'charge.refunded', 'charge.dispute.created', 'charge.dispute.closed', 'transfer.created', 'transfer.reversed', 'payout.paid', 'payout.failed'] as const;

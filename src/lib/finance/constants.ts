/**
 * NEW FINANCE SYSTEM — canonical constants.
 * All money is stored server-side in cents; percentages use basis points.
 * These are UI defaults only. Authoritative values live in `fin_settings`.
 */
export const DEFAULT_PLATFORM_FEE_BPS = 200; // 2.00%
export const DEFAULT_STANDARD_HOLD_HOURS = 48;
export const DEFAULT_MEDICAID_HOLD_DAYS = 15;

export const PAYMENT_STATE_LABELS: Record<string, string> = {
  none: "No payment yet",
  invoiced: "Invoiced",
  paid: "Paid",
  validated: "Payment validated",
  refunded: "Refunded",
};

export const PAYOUT_STATE_LABELS: Record<string, string> = {
  none: "No payout",
  holding: "Holding period",
  releasable: "Ready to release",
  released_to_balance: "In provider balance",
  paid_out: "Paid to provider",
  cashed_out: "Cashed out",
  cancelled: "Cancelled",
};

export const PAYER_KIND_LABELS: Record<string, string> = {
  patient: "Patient (self-pay)",
  facility: "Facility",
  broker: "Broker",
  workers_comp: "Workers Comp",
  medicaid: "Medicaid",
  provider_self: "Provider (self-assigned)",
};

export function formatCents(cents: number | null | undefined): string {
  const n = (cents ?? 0) / 100;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function bpsToPct(bps: number): string {
  return (bps / 100).toFixed(2) + "%";
}

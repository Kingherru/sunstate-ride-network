/**
 * Payment gate — a trip may not be sent/assigned to a performing provider until
 * an invoice exists AND payment has been collected. Shared by server functions
 * (dispatch assignment, referrals) and the portal UI badges.
 */

export type PaymentGateTrip = {
  payment_status?: string | null;
  fin_payment_state?: string | null;
};

/** Payment has actually been received (or validated by finance). */
export function isTripPaid(trip: PaymentGateTrip | null | undefined): boolean {
  const pay = String(trip?.payment_status ?? "").toLowerCase();
  const fin = String(trip?.fin_payment_state ?? "").toLowerCase();
  return (
    ["paid", "validated", "confirmed"].includes(pay) ||
    ["paid", "validated"].includes(fin)
  );
}

/** An invoice has been created/sent for this trip. */
export function isTripInvoiced(trip: PaymentGateTrip | null | undefined): boolean {
  const pay = String(trip?.payment_status ?? "").toLowerCase();
  const fin = String(trip?.fin_payment_state ?? "").toLowerCase();
  if (isTripPaid(trip)) return true;
  return ["pending", "invoiced"].includes(pay) || ["invoiced"].includes(fin);
}

/** Null when the trip may be assigned, otherwise a user-facing blocking reason. */
export function assignmentBlockReason(trip: PaymentGateTrip | null | undefined): string | null {
  if (!isTripInvoiced(trip)) {
    return "An invoice must be created for this trip before it can be sent to a provider.";
  }
  if (!isTripPaid(trip)) {
    return "Payment has not been collected yet. This trip cannot be assigned to a provider until payment is received.";
  }
  return null;
}

export const WAITING_ON_PAYMENT_LABEL = "Waiting on Payment";

export const WAITING_ON_PAYMENT_NOTE =
  "Do not perform this trip until payment is received. It will move to your Reservations tab automatically once payment clears.";

export const PROVIDER_MEMBERSHIP_PRICE = 'nemt_membership_monthly_v2';
/** Invoice settlement is proof, not checkout completion, trial or processing fees. */
export function isQualifyingMembershipInvoice(invoice: { status?: string | null; paid?: boolean; currency?: string; amount_paid?: number; billing_reason?: string | null }, subscription: { status?: string; trial_end?: number | null; current_period_end?: number | null }, now: number) {
  return invoice.status === 'paid' && invoice.paid === true && invoice.currency === 'usd' && invoice.amount_paid === 1000 &&
    ['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason ?? '') &&
    subscription.status === 'active' && (!subscription.trial_end || subscription.trial_end <= now) &&
    typeof subscription.current_period_end === 'number' && subscription.current_period_end > now;
}
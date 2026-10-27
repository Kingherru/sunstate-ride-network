import { BASE_MEMBERSHIP_PRICE, MEMBERSHIP_PRICING } from './membership-pricing';
export const PROVIDER_MEMBERSHIP_PRICE = BASE_MEMBERSHIP_PRICE;
/** A paid invoice covering the $15 base (alone, or with the $10 Network add-on). */
const QUALIFYING_AMOUNTS: number[] = [MEMBERSHIP_PRICING.baseCents, MEMBERSHIP_PRICING.combinedCents];
/** Invoice settlement is proof, not checkout completion, trial or processing fees. */
export function isQualifyingMembershipInvoice(invoice: { status?: string | null; paid?: boolean; currency?: string; amount_paid?: number; billing_reason?: string | null }, subscription: { status?: string; trial_end?: number | null; current_period_end?: number | null }, now: number) {
  return invoice.status === 'paid' && invoice.paid === true && invoice.currency === 'usd' && QUALIFYING_AMOUNTS.includes(invoice.amount_paid ?? -1) &&
    ['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason ?? '') &&
    subscription.status === 'active' && (!subscription.trial_end || subscription.trial_end <= now) &&
    typeof subscription.current_period_end === 'number' && subscription.current_period_end > now;
}

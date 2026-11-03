import { BASE_MEMBERSHIP_PRICE, MEMBERSHIP_PRICING, QUALIFYING_BASE_CENTS } from './membership-pricing';
export const PROVIDER_MEMBERSHIP_PRICE = BASE_MEMBERSHIP_PRICE;
/** A paid invoice covering the base (alone, or with the Network add-on). Add-on alone never qualifies. */
const QUALIFYING_AMOUNTS: number[] = QUALIFYING_BASE_CENTS.flatMap(b => [b, b + MEMBERSHIP_PRICING.networkCents]);
/** Invoice settlement is proof, not checkout completion, trial or processing fees. */
export function isQualifyingMembershipInvoice(invoice: { status?: string | null; paid?: boolean; currency?: string; amount_paid?: number; billing_reason?: string | null }, subscription: { status?: string; trial_end?: number | null; current_period_end?: number | null }, now: number, oneTimeCents = 0) {
  return invoice.status === 'paid' && invoice.paid === true && invoice.currency === 'usd' && QUALIFYING_AMOUNTS.includes((invoice.amount_paid ?? -1) - oneTimeCents) &&
    ['subscription_create','subscription_cycle','subscription_update'].includes(invoice.billing_reason ?? '') &&
    subscription.status === 'active' && (!subscription.trial_end || subscription.trial_end <= now) &&
    typeof subscription.current_period_end === 'number' && subscription.current_period_end > now;
}

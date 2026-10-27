/** Approved provider pricing. Network transaction/platform fee is separate and unchanged. */
export const BASE_MEMBERSHIP_PRICE = 'nemt_provider_base_monthly';
export const NETWORK_ADDON_PRICE = 'nemt_network_addon_monthly';
/** Former $10 full-network membership; existing subscribers move to the new pricing at renewal only. */
export const LEGACY_MEMBERSHIP_PRICE = 'nemt_membership_monthly_v2';

export const MEMBERSHIP_PRICING = {
  baseCents: 1500,
  networkCents: 1000,
  combinedCents: 2500,
  trialDays: 30,
} as const;

export const PRICING_COPY = {
  trial: '30 DAYS FREE',
  base: '$15/MONTH BASE PROVIDER MEMBERSHIP',
  network: 'OPTIONAL $10/MONTH REFERRAL NETWORK ADD-ON',
  combined: '$25/MONTH WITH BOTH AFTER THE SHARED TRIAL',
  sentence: '30 days free, then $15 per month for the Base Provider Membership. The optional Referral Network add-on is $10 per month ($25 per month with both after the shared trial).',
} as const;

export type BaseStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'pending_transition' | 'needs_review' | 'none';
export type AddonStatus = 'not_selected' | 'trialing' | 'active' | 'past_due' | 'canceling' | 'canceled' | 'needs_review';

export const BASE_STATUS_LABEL: Record<BaseStatus, string> = {
  trialing: 'Trialing', active: 'Active', past_due: 'Past due', canceled: 'Canceled',
  pending_transition: 'Pending transition', needs_review: 'Needs Review', none: 'Not started',
};
export const ADDON_STATUS_LABEL: Record<AddonStatus, string> = {
  not_selected: 'Not selected', trialing: 'Trialing', active: 'Active', past_due: 'Past due',
  canceling: 'Canceling', canceled: 'Canceled', needs_review: 'Needs Review',
};

/** Derive the Network add-on status from Stripe subscription items (server evidence only). */
export function addonStatusFromStripe(sub: { status?: string; items?: { data?: any[] } }, addonItem: any | undefined, cancelAt: number | null): AddonStatus {
  if (!addonItem) return 'not_selected';
  if (cancelAt) return 'canceling';
  switch (sub.status) {
    case 'trialing': return 'trialing';
    case 'active': return 'active';
    case 'past_due': case 'unpaid': return 'past_due';
    case 'canceled': case 'incomplete_expired': return 'canceled';
    default: return 'needs_review';
  }
}

export function recurringTotalCents(base: boolean, network: boolean): number {
  return (base ? MEMBERSHIP_PRICING.baseCents : 0) + (base && network ? MEMBERSHIP_PRICING.networkCents : 0);
}

export function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

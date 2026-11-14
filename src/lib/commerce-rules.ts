import { eligibleCartItems, type CartCourse } from './training/cart-rules';
import { MEMBERSHIP_PRICING } from './membership-pricing';

export type CommerceSelection = { base: boolean; network: boolean; contractor?: boolean; courses: CartCourse[] };
export type CommerceContext = { ownedCourseIds: readonly string[]; baseActive: boolean; addonActive: boolean };
export type Confirmation = { recurring: boolean; oneTime: boolean; terms: boolean };

/** Removes duplicates/owned items and enforces that the Network add-on needs a base membership. */
export function normalizeSelection(sel: CommerceSelection, ctx: CommerceContext) {
  const notices: string[] = [];
  const contractor = sel.contractor === true;
  const base = !contractor && sel.base && !ctx.baseActive;
  if (sel.base && ctx.baseActive) notices.push('You already have a Provider Base Membership.');
  let network = !contractor && sel.network && !ctx.addonActive;
  if (sel.network && ctx.addonActive) notices.push('The Referral Network add-on is already on your membership.');
  if (network && !base && !ctx.baseActive) { network = false; notices.push('The Referral Network add-on requires the Provider Base Membership.'); }
  const courses = eligibleCartItems(sel.courses, ctx.ownedCourseIds);
  return { base, network, contractor, courses, notices };
}

export function commerceTotals(sel: { base: boolean; network: boolean; contractor?: boolean; courses: { price_cents: number }[] }, trialEligible: boolean, payNow = false) {
  const recurringCents = (sel.contractor ? 2000 : 0) + (sel.base ? MEMBERSHIP_PRICING.baseCents : 0) + (sel.network ? MEMBERSHIP_PRICING.networkCents : 0);
  const oneTimeCents = sel.courses.reduce((s, c) => s + c.price_cents, 0);
  const dueTodayCents = oneTimeCents + (sel.base && trialEligible && !payNow ? 0 : recurringCents);
  return { recurringCents, oneTimeCents, dueTodayCents };
}

/** Every relevant confirmation must be checked before checkout. */
export function confirmationComplete(sel: { base: boolean; network: boolean; contractor?: boolean; courses: unknown[] }, c: Confirmation) {
  const hasRecurring = sel.base || sel.network || sel.contractor;
  const hasOneTime = sel.courses.length > 0;
  if (!hasRecurring && !hasOneTime) return false;
  return c.terms && (!hasRecurring || c.recurring) && (!hasOneTime || c.oneTime);
}

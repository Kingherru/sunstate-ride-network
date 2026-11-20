import { assertCheckoutConsent, type CheckoutConsent } from './payment-policy';
export type ReferralReview = { amountCents: number; expiresAt: string; paymentAcknowledged: boolean; consent: CheckoutConsent };
export function validateReferralReview(review: ReferralReview, now = Date.now()) {
  assertCheckoutConsent(review.consent);
  if (!review.paymentAcknowledged || !Number.isSafeInteger(review.amountCents) || review.amountCents <= 0 || !Number.isFinite(Date.parse(review.expiresAt)) || Date.parse(review.expiresAt) <= now) throw new Error('Review compensation, a future expiration and payment responsibility.');
}
/** Calls the existing engine; preparation is never reported as delivery or funding. */
export async function continueOwnedReferral(tripId: string, review: ReferralReview, actions: {
  prepare: (tripId: string, review: ReferralReview) => Promise<string>;
  send: (distributionId: string) => Promise<{ recipients: number }>;
}) {
  validateReferralReview(review);
  try {
    const distributionId = await actions.prepare(tripId, review);
    const wave = await actions.send(distributionId);
    return { tripId, distributionId, sent: wave.recipients > 0, message: wave.recipients > 0 ? 'Trip saved — referral sent' : 'Trip saved — referral not sent', reason: wave.recipients > 0 ? null : 'No eligible receiver was offered this trip.' };
  } catch {
    return { tripId, sent: false, message: 'Trip saved — referral not sent', reason: 'Membership, funding, matching or launch readiness requires review in Network.' };
  }
}
import { customerQuoteInput } from './provider-customer-pricing';
import type { RideRequestInput, DeliveryRequestInput } from './request-schemas';

export function workspaceQuoteInput(form: RideRequestInput | DeliveryRequestInput | null, miles: string, wait: string) {
  if (!form) return null;
  const delivery = 'requestedDate' in form;
  const parsed = customerQuoteInput.safeParse({
    service: delivery ? 'medical_delivery' : form.transportType === 'gurney' ? 'stretcher' : form.transportType,
    miles: miles.trim() ? Number(miles) : NaN,
    waitMinutes: wait.trim() ? Number(wait) : NaN,
    pickupDate: delivery ? form.requestedDate : form.pickupDate,
    pickupTime: delivery ? form.requestedTime : form.pickupTime,
    roundTrip: !delivery && form.tripType === 'round_trip',
    additionalStops: delivery ? 0 : form.additionalStops.length,
    signature: delivery && form.signatureRequired,
    outcome: 'normal',
  });
  return parsed.success ? parsed.data : null;
}

/** In-memory review identity only. No trip information is persisted in the browser. */
export function tripReviewKey(form: unknown, pricingInputs?: unknown): string | null {
  if (!form) return null;
  return JSON.stringify({ form, pricingInputs: pricingInputs ?? null });
}

export function canAttachTripQuote(input: { currentKey: string | null; confirmedKey: string | null; quoteId: string | null; draftId: string | null; referral: boolean }): boolean {
  return !input.referral && !!input.quoteId && !!input.draftId && !!input.currentKey && input.currentKey === input.confirmedKey;
}
/** In-memory review identity only. No trip information is persisted in the browser. */
export function tripReviewKey(form: unknown, pricingInputs?: unknown): string | null {
  if (!form) return null;
  return JSON.stringify({ form, pricingInputs: pricingInputs ?? null });
}

export function canAttachTripQuote(input: { currentKey: string | null; confirmedKey: string | null; quoteId: string | null; draftId: string | null; referral: boolean }): boolean {
  return !input.referral && !!input.quoteId && !!input.draftId && !!input.currentKey && input.currentKey === input.confirmedKey;
}
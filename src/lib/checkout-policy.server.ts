import { assertCheckoutConsent, PAYMENT_POLICY_VERSION, TERMS_VERSION, type CheckoutConsent } from './payment-policy';
import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type AuthoritativePurchaseReview = { personId: string; workspaceId: string | null; referenceType: 'customer_invoice' | 'facility_invoice' | 'referral_funding' | 'membership' | 'network_addon' | 'combined_cart' | 'training' | 'test'; referenceId: string; invoiceId?: string; amountCents: number; providerPolicy?: { version: string; text: string }; payer: string; merchant: string; recurring: boolean; fees: { label: string; cents: number }[]; checkoutKey: string; attribution: string };
/** Only call with amounts/identity/references read from authoritative stores in the payment handler. */
export async function recordCheckoutAcceptance(consent: CheckoutConsent | undefined, review: AuthoritativePurchaseReview) {
  assertCheckoutConsent(consent);
  const { data: gate } = await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','checkout_policy_acceptance_writes').maybeSingle();
  if (gate?.enabled !== true) throw new Error('Purchase acceptance recording is not enabled. Nothing was saved.');
  if (!Number.isSafeInteger(review.amountCents) || review.amountCents < 0 || !review.merchant || !review.payer || !review.attribution) throw new Error('Complete authoritative purchase review required.');
  if (['customer_invoice','facility_invoice'].includes(review.referenceType) && !review.providerPolicy?.text.trim()) throw new Error('Disclosed provider cancellation/no-show policy required.');
  const snapshot = { payer: review.payer, merchant: review.merchant, recurring: review.recurring, fees: review.fees, amountCents: review.amountCents, currency: 'usd', termsVersion: TERMS_VERSION, refundVersion: PAYMENT_POLICY_VERSION, providerPolicy: review.providerPolicy ?? null };
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({ ...snapshot, reference:review.referenceId, attribution:review.attribution, checkoutKey:review.checkoutKey })));
  const attributionHash = Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
  const { data, error } = await supabaseAdmin.from('checkout_policy_acceptances').insert({ person_id:review.personId, workspace_id:review.workspaceId, reference_type:review.referenceType, reference_id:review.referenceId, invoice_id:review.invoiceId??null, amount_cents:review.amountCents, currency:'usd', terms_version:TERMS_VERSION, refund_version:PAYMENT_POLICY_VERSION, provider_policy_snapshot:review.providerPolicy??null, review_snapshot:snapshot, attribution_hash:attributionHash, checkout_key:review.checkoutKey }).select('id,mfn_id').single();
  if (error || !data) throw new Error('Purchase acceptance could not be retained. No payment may be created.');
  return data;
}
export async function requireCheckoutPreparationEnabled() {
  const { data } = await supabaseAdmin.from('platform_launch_flags').select('enabled').eq('key','commerce_checkout_preparation').maybeSingle();
  if (data?.enabled !== true) throw new Error('Checkout preparation is off. Approved product-specific purchase terms and exact fee review are required. No payment was created.');
}
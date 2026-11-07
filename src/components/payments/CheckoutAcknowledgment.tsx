import { useId } from 'react';
import { TERMS_VERSION_URL, REFUND_VERSION_URL } from '@/lib/payment-policy';

/** Controlled, never-preselected clickwrap. Version links open without replacing checkout state. */
export function CheckoutAcknowledgment({ accepted, onChange, disabled = false, providerPolicy }: { accepted: boolean; onChange: (accepted: boolean) => void; disabled?: boolean; providerPolicy?: string }) {
  const id = useId();
  return <div className="checkout-acknowledgment space-y-3">
    {providerPolicy !== undefined && <section aria-label="Provider cancellation and no-show policy" className="border-t border-ds-border pt-3"><h4 className="ds-label">Provider cancellation / no-show terms</h4><p className="ds-body whitespace-pre-wrap">{providerPolicy || 'Required provider policy not supplied. Payment is unavailable.'}</p></section>}
    <label htmlFor={id} className="ds-body flex items-start gap-3"><input id={id} type="checkbox" checked={accepted} disabled={disabled} onChange={e => onChange(e.target.checked)} className="mt-1 size-4 shrink-0"/><span>I have reviewed and agree to the <a href={TERMS_VERSION_URL} target="_blank" rel="noopener noreferrer" className="text-ds-link underline">Terms and Conditions<span className="sr-only"> version November 7, 2026 (opens in a new tab)</span></a> and the <a href={REFUND_VERSION_URL} target="_blank" rel="noopener noreferrer" className="text-ds-link underline">Refund &amp; Payment Reversal Policy<span className="sr-only"> version November 7, 2026 (opens in a new tab)</span></a>, including the cancellation, no-show and fee terms shown for this purchase.</span></label>
  </div>;
}
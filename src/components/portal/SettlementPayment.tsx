import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { toast } from 'sonner';
import { DsButton } from '@/components/ds/controls';
import { getStripe, getStripeEnvironment } from '@/lib/stripe';
import { getSettlementPaymentQuote, startSettlementPayment, confirmSettlementCompletion, ACH_AVAILABLE, type PaymentQuote } from '@/lib/network-payments.functions';
import type { SettlementRow } from '@/lib/network-settlements.functions';
import { usePortalPreview } from './preview-data';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

function PayForm({ total, onDone }: { total: number; onDone: () => void }) {
  const stripe = useStripe(), elements = useElements();
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  return <div className="space-y-3">
    <PaymentElement />
    {err && <p role="alert" className="ds-caption text-ds-error">{err}</p>}
    <DsButton disabled={!stripe || busy} onClick={async () => {
      if (!stripe || !elements) return; setBusy(true); setErr(null);
      const r = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: window.location.href } });
      setBusy(false);
      if (r.error) setErr(r.error.message ?? 'Payment was not completed.'); else onDone();
    }}>{busy ? 'Processing…' : `Pay ${money(total)} (test mode)`}</DsButton>
  </div>;
}

/** Sender payment-due panel. Totals come from the server fee policy and are locked to the attempt. */
export function SettlementPayment({ row, payable }: { row: SettlementRow; payable: boolean }) {
  const preview = usePortalPreview(); const qc = useQueryClient();
  const quote = useServerFn(getSettlementPaymentQuote), start = useServerFn(startSettlementPayment), confirm = useServerFn(confirmSettlementCompletion);
  const [q, setQ] = useState<PaymentQuote | null>(null); const [ack, setAck] = useState(false);
  const [secret, setSecret] = useState<string | null>(null); const [locked, setLocked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false);
  const reviewOpen = row.review_window_ends_at && Date.now() < Date.parse(row.review_window_ends_at) && !row.completion_confirmed_at;
  let env: 'sandbox' | 'live' | null = null; try { env = getStripeEnvironment(); } catch { env = null; }

  if (preview.active) return <section className="rounded-ds border border-ds-border bg-ds-sky p-3"><p className="ds-label uppercase">Payment due</p><p className="ds-caption">Preview only — no payment can be started and no information is saved.</p></section>;
  if (done) return <section className="rounded-ds border border-ds-border bg-ds-sky p-3 ds-caption">Payment submitted. The settlement moves to Paid / Held only after Stripe confirms it.</section>;
  return <section className="rounded-ds border border-ds-peach-border bg-ds-peach p-3 space-y-3">
    <p className="ds-label uppercase">Payment due (test mode)</p>
    {reviewOpen && <div className="space-y-2"><p className="ds-caption">The 24-hour review window is open. Confirm completion to pay now, or open a dispute below.</p>
      <DsButton variant="ghost" disabled={busy} onClick={async () => { setBusy(true); try { await confirm({ data: { settlementId: row.id, confirmed: true } }); toast.success('Completion confirmed.'); qc.invalidateQueries({ queryKey: ['network-settlements'] }); } catch (e) { toast.error((e as Error).message); } setBusy(false); }}>Confirm completion</DsButton></div>}
    {!env && <p className="ds-caption text-ds-error">Payments are not configured for this build.</p>}
    {env === 'live' && <p className="ds-caption">Live Network payments are not turned on.</p>}
    {env === 'sandbox' && payable && !reviewOpen && !secret && <>
      <div className="flex flex-wrap gap-2">
        <DsButton variant="ghost" disabled={busy} onClick={async () => { setBusy(true); const r = await quote({ data: { settlementId: row.id, method: 'card', environment: env! } }); setBusy(false); if ('error' in r) toast.error(r.error); else setQ(r.quote); }}>Card or wallet</DsButton>
        <DsButton variant="ghost" disabled title="Bank (ACH) payment needs Stripe ACH Direct Debit confirmed on the test account first.">Bank (ACH) — unavailable</DsButton>
      </div>
      {!ACH_AVAILABLE && <p className="ds-caption text-ds-on-subtle">Bank (ACH) is not available yet. Apple Pay or Google Pay appear inside the card form only when Stripe offers them on your device.</p>}
      {q && <div className="space-y-2 ds-caption tabular-nums">
        <p>Receiver amount: <strong>{money(q.receiver_payout_cents)}</strong></p>
        <p>MY FLORIDA NEMT Network fee (2%): {money(q.network_fee_cents)}</p>
        <p>Card processing fee: {money(q.processing_fee_cents)}{q.sandbox_estimate && ' (test-mode estimate)'}</p>
        <p className="ds-label">Total due: {money(q.total_cents)}</p>
        <label className="flex items-start gap-2"><input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} /> <span>I confirm my business is responsible for this payment and this exact total. No fee will be added later.</span></label>
        <DsButton disabled={!ack || busy} onClick={async () => { setBusy(true); const r = await start({ data: { settlementId: row.id, method: 'card', environment: env!, acknowledged: true } }); setBusy(false); if ('error' in r) toast.error(r.error); else { setSecret(r.clientSecret); setLocked(r.attempt.total_cents); } }}>{busy ? 'Preparing…' : 'Continue to payment'}</DsButton>
      </div>}
    </>}
    {secret && locked != null && <Elements stripe={getStripe()} options={{ clientSecret: secret }}><p className="ds-caption">Locked total: <strong>{money(locked)}</strong></p><PayForm total={locked} onDone={() => { setDone(true); qc.invalidateQueries({ queryKey: ['network-settlements'] }); }} /></Elements>}
  </section>;
}

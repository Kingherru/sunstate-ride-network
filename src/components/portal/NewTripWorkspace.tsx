import { useCallback, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { FileText, RefreshCw } from 'lucide-react';
import { RequestForm } from '@/components/requests/RequestForm';
import { TripCommerceContext, type CommerceFormData } from '@/components/requests/trip-commerce-context';
import { DsButton, DsCheckbox, DsField, DsInput, DsTextarea } from '@/components/ds/controls';
import { confirmTripCustomerQuote, getReferralFundingPreparation } from '@/lib/trip-invoices.functions';
import { calculateProviderCustomerQuote } from '@/lib/provider-customer-pricing.functions';
import { customerQuoteInput } from '@/lib/provider-customer-pricing';
import { saveTripDraft } from '@/lib/trip-drafts.functions';
import { usePortalPreview, previewBlocked } from './preview-data';
import { StatusPill } from '@/components/ds/status';
import type { InvoiceLine } from '@/lib/trip-invoice-rules';
const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const warning = 'Warning: You are responsible for paying for trips you send to other providers. Failure to pay may result in the loss of your verification status, account suspension, or removal from the platform.';
type Quote = { id: string; lines: InvoiceLine[]; totalCents: number; version: number; rateVersion?: number; terms?: string };
export function NewTripWorkspace({ workspaceId, provider, initialDraft }: { workspaceId: string; provider: boolean; initialDraft?: { id: string; payload: Record<string, unknown>; quoteHistory?: unknown } }) {
  const preview = usePortalPreview(); const [form, setForm] = useState<CommerceFormData | null>(null);
  const change = useCallback((value: CommerceFormData) => setForm(value), []);
  const [miles, setMiles] = useState(''); const [wait, setWait] = useState('0'); const [manualConfirmed, setManualConfirmed] = useState(false);
  const [terms, setTerms] = useState(''); const [discount, setDiscount] = useState('0'); const [adjustment, setAdjustment] = useState('0'); const [reason, setReason] = useState('');
  const [network, setNetwork] = useState(false); const [receiver, setReceiver] = useState(''); const [ack, setAck] = useState(false); const [busy, setBusy] = useState(false);
  const history = Array.isArray(initialDraft?.quoteHistory) ? initialDraft.quoteHistory as Quote[] : [];
  const [confirmed, setConfirmed] = useState<Quote | null>(history.at(-1) ?? null); const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [quoteForm, setQuoteForm] = useState<string | null>(history.length ? JSON.stringify(initialDraft?.payload) : null);
  const [calculated, setCalculated] = useState<{ lines: InvoiceLine[]; totalCents: number } | null>(null);
  const [funding, setFunding] = useState<{ networkFeeCents: number; processingCents: number | null; totalCents: number | null; blocker: string; policyVersion: number | null } | null>(null);
  const [details, setDetails] = useState(false); const [examples, setExamples] = useState(true);
  const calculate = useServerFn(calculateProviderCustomerQuote); const confirm = useServerFn(confirmTripCustomerQuote); const save = useServerFn(saveTripDraft); const prepareFunding = useServerFn(getReferralFundingPreparation);
  const unchanged = quoteForm === JSON.stringify(form); const attachment = confirmed && draftId && unchanged && !network ? { id: confirmed.id, draftId } : null;
  const demoLines: InvoiceLine[] = [{ label: 'Pickup / loading', cents: 4000 }, { label: 'Mileage after included miles', cents: 3000 }];
  const shown = preview.active && examples ? { lines: demoLines, totalCents: 7000 } : calculated ?? confirmed;
  function tripInput() {
    const delivery = form && 'requestedDate' in form;
    return customerQuoteInput.parse({ service: delivery ? 'medical_delivery' : form && 'transportType' in form ? form.transportType === 'gurney' ? 'stretcher' : form.transportType : 'ambulatory', miles: miles.trim() === '' ? NaN : Number(miles), waitMinutes: Number(wait), pickupDate: delivery ? form.requestedDate : form && 'pickupDate' in form ? form.pickupDate : '', pickupTime: delivery ? form.requestedTime : form && 'pickupTime' in form ? form.pickupTime : '', roundTrip: form && 'tripType' in form && form.tripType === 'round_trip', additionalStops: form && 'additionalStops' in form ? form.additionalStops.length : 0, signature: delivery && form.signatureRequired, outcome: 'normal' });
  }
  async function recalculate() {
    if (preview.active) return previewBlocked(); if (!provider) return;
    setBusy(true); try { const quote = await calculate({ data: { workspaceId, trip: tripInput() } }); setCalculated(quote); } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function confirmQuote() {
    if (preview.active) return previewBlocked(); if (!form || !manualConfirmed || !provider) return;
    if (confirmed && !window.confirm('Replace the confirmed draft quote? Its original version will remain in history.')) return;
    setBusy(true); try {
      const saved = await save({ data: { draft_id: draftId, payload: form, autosaved: false } }); setDraftId(saved.id);
      const adjustments = [Number(discount) ? { kind: 'discount' as const, cents: Number(discount), reason } : null, Number(adjustment) ? { kind: 'adjustment' as const, cents: Number(adjustment), reason } : null].filter(v => v !== null);
      const quote = await confirm({ data: { workspaceId, draftId: saved.id, trip: tripInput(), mileageConfirmed: true, expectedQuoteId: confirmed?.id ?? null, replacementConfirmed: !!confirmed, adjustments, terms } });
      setConfirmed(quote); setCalculated(quote); setQuoteForm(JSON.stringify(form)); toast.success('Quote confirmed. Submit the unchanged trip to attach its invoice.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function fundingReview() {
    if (preview.active) return previewBlocked(); if (!ack) return;
    setBusy(true); try { setFunding(await prepareFunding({ data: { workspaceId, receiverCents: Number(receiver), environment: 'sandbox' } })); } catch (e) { toast.error(e instanceof Error ? e.message : 'Funding unavailable.'); } finally { setBusy(false); }
  }
  return <TripCommerceContext.Provider value={{ onChange: change, quote: attachment, business: true, submissionBlocked: network || !!confirmed && !unchanged }}>
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0"><RequestForm context="portal" initialDraft={initialDraft} allowProviderSelection={!provider}/></div>
      <aside className="min-w-0 self-start border border-ds-border bg-ds-surface xl:sticky xl:top-24">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border bg-ds-sky p-4"><h2 className="ds-subheading uppercase">{network ? 'Fund Referral' : 'Live Invoice'}</h2><FileText className="size-5 text-ds-primary"/></header>
        <div className="flex items-center justify-between gap-3 border-b border-ds-border p-4"><span className="portal-money">{network ? funding?.totalCents != null ? money(funding.totalCents) : 'Funding required' : shown ? money(shown.totalCents) : 'Quote required'}</span><DsButton variant="ghost" className="xl:hidden" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Hide details' : 'Invoice details'}</DsButton></div>
        <div className={`${details ? 'block' : 'hidden'} space-y-5 p-4 xl:block`}>
          {preview.active && <div className="flex flex-wrap gap-2"><p className="ds-caption">Synthetic example — all financial actions blocked.</p><DsButton variant="ghost" onClick={() => setExamples(!examples)}>{examples ? 'Remove example' : 'Show example'}</DsButton></div>}
          {provider && <DsCheckbox label="Send through Referral Network" checked={network} onChange={e => { setNetwork(e.target.checked); setFunding(null); setAck(false); }}/>} 
          {!provider ? <div className="space-y-3"><StatusPill status="Pending"/><p className="ds-body">Quote required</p><p className="ds-support">Your chosen provider must supply an approved customer quote. Private provider rates are not available to this account.</p></div> : network ? <>
            <p className="ds-support">Service, general route and compensation only. Patient identity remains protected under existing assignment rules.</p>
            <DsField label="Proposed receiver compensation (cents)">{p => <DsInput {...p} type="number" min="1" step="1" value={receiver} onChange={e => setReceiver(e.target.value)}/>}</DsField>
            <dl className="space-y-2 ds-body"><div className="flex justify-between gap-3"><dt>Network fee (2%)</dt><dd className="portal-money">{funding ? money(funding.networkFeeCents) : 'Not prepared'}</dd></div><div className="flex justify-between gap-3"><dt>Processing recovery</dt><dd className="portal-money">{funding?.processingCents != null ? money(funding.processingCents) : 'Configuration required'}</dd></div><div className="flex justify-between gap-3"><dt>Customer invoice / retained amount</dt><dd>No invoice issued</dd></div><div className="flex justify-between gap-3"><dt>Sender margin</dt><dd>Not available</dd></div></dl>
            <p role="note" className="ds-body border-y border-ds-border py-4 font-semibold">{warning}</p><DsCheckbox label="I confirm the compensation and payment responsibility" checked={ack} onChange={e => setAck(e.target.checked)}/><DsButton disabled={!ack || busy} onClick={fundingReview}>Review funding preparation</DsButton>{funding && <p className="ds-support">{funding.blocker}</p>}<p className="ds-caption">Not funded · No offer sent · Hold: standard 10 days, Super/Gold Verified 4 days. Existing 24-hour dispute window and payment deadlines are unchanged.</p><Link to="/portal/network" className="ds-label text-ds-link underline">Open controlled Network offers</Link>
          </> : <>
            <DsField label="MANUAL MILEAGE — total billable route miles">{p => <DsInput {...p} type="number" min="0" step="0.1" value={miles} onChange={e => { setMiles(e.target.value); setManualConfirmed(false); setCalculated(null); setQuoteForm(null); }}/>}</DsField>
            <DsCheckbox label="I confirm these are actual route miles, including applicable return travel" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)}/>
            <DsField label="Wait time (minutes)">{p => <DsInput {...p} type="number" min="0" value={wait} onChange={e => { setWait(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsButton variant="secondary" disabled={busy} onClick={recalculate}><RefreshCw className="size-4"/>Calculate quote</DsButton>
            {shown && <ul className="divide-y divide-ds-border">{shown.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-3 ds-body"><span>{l.label}{l.reason && <small className="block ds-caption">{l.reason}</small>}</span><span className="portal-money shrink-0">{money(l.cents)}</span></li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-2"><DsField label="Discount (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={discount} onChange={e => { setDiscount(e.target.value); setQuoteForm(null); }}/>}</DsField><DsField label="Adjustment (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={adjustment} onChange={e => { setAdjustment(e.target.value); setQuoteForm(null); }}/>}</DsField></div>
            <DsField label="Adjustment / discount reason">{p => <DsInput {...p} value={reason} onChange={e => { setReason(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsField label="Provider terms — cancellation / no-show terms are informational only">{p => <DsTextarea {...p} value={terms} maxLength={3000} onChange={e => { setTerms(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <p className="ds-support">Processing: not applied — approved collection configuration required. Amount paid and balance appear only on an issued invoice.</p>
            <DsButton disabled={busy || !manualConfirmed} onClick={confirmQuote}>{confirmed ? 'Confirm replacement quote' : 'Confirm quote snapshot'}</DsButton>
            {confirmed && <p className="ds-support">Quote version {confirmed.version} · {unchanged ? 'Confirmed for this trip' : 'Trip or price inputs changed — confirm replacement before attaching invoice'}</p>}
          </>}
        </div>
      </aside>
    </div>
  </TripCommerceContext.Provider>;
}
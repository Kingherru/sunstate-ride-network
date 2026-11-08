import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { FileText, RefreshCw } from 'lucide-react';
import {FacilityQuoteInbox} from './FacilityQuoteInbox';
import {requestFacilityQuote} from '@/lib/facility-billing.functions';
import { FacilityBillingReview } from './FacilityBillingReview';
import { CheckoutAcknowledgment } from '@/components/payments/CheckoutAcknowledgment';
import { RequestForm } from '@/components/requests/RequestForm';
import { TripCommerceContext, type CommerceFormData } from '@/components/requests/trip-commerce-context';
import { DsButton, DsCheckbox, DsField, DsInput, DsTextarea } from '@/components/ds/controls';
import { confirmTripCustomerQuote, getReferralFundingPreparation } from '@/lib/trip-invoices.functions';
import { calculateProviderCustomerQuote } from '@/lib/provider-customer-pricing.functions';
import { workspaceQuoteInput, tripReviewKey, canAttachTripQuote } from '@/lib/trip-workspace-review';
import { saveTripDraft } from '@/lib/trip-drafts.functions';
import { usePortalPreview, previewBlocked } from './preview-data';
import { StatusPill } from '@/components/ds/status';
import type { InvoiceLine } from '@/lib/trip-invoice-rules';
const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const warning = 'Warning: You are responsible for paying for trips you send to other providers. Failure to pay may result in the loss of your verification status, account suspension, or removal from the platform.';
type Quote = { id: string; lines: InvoiceLine[]; totalCents: number; version: number; rateVersion?: number; terms?: string; pricingSnapshot?: {version:number} };
export function NewTripWorkspace({ workspaceId, provider, initialDraft }: { workspaceId: string; provider: boolean; initialDraft?: { id: string; payload: Record<string, unknown>; quoteHistory?: unknown } }) {
  const preview = usePortalPreview(); const [form, setForm] = useState<CommerceFormData | null>(null);
  const change = useCallback((value: CommerceFormData) => setForm(value), []);
  const [miles, setMiles] = useState(''); const [wait, setWait] = useState('0'); const [manualConfirmed, setManualConfirmed] = useState(false);
  const [terms, setTerms] = useState(''); const [discount, setDiscount] = useState('0'); const [adjustment, setAdjustment] = useState('0'); const [reason, setReason] = useState('');
  const [policyAccepted,setPolicyAccepted]=useState(false);
  const [network, setNetwork] = useState(false); const [receiver, setReceiver] = useState(''); const [ack, setAck] = useState(false); const [busy, setBusy] = useState(false);
  const history = Array.isArray(initialDraft?.quoteHistory) ? initialDraft.quoteHistory as Quote[] : [];
  const [confirmed, setConfirmed] = useState<Quote | null>(history.at(-1) ?? null); const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  // Resumed snapshots stay historical until the current trip AND mileage/adjustments are confirmed.
  const [quoteForm, setQuoteForm] = useState<string | null>(null);
  const [calculated, setCalculated] = useState<{ lines: InvoiceLine[]; totalCents: number; pricingSnapshot?: {version:number} } | null>(null);
  const [funding, setFunding] = useState<{ networkFeeCents: number; processingCents: number | null; totalCents: number | null; blocker: string; policyVersion: number | null } | null>(null);
  const [details, setDetails] = useState(false); const [examples, setExamples] = useState(true);
  const [estimateMessage, setEstimateMessage] = useState('');
  const [estimating, setEstimating] = useState(false);
  const requestFacility=useServerFn(requestFacilityQuote);
  const calculate = useServerFn(calculateProviderCustomerQuote); const confirm = useServerFn(confirmTripCustomerQuote); const save = useServerFn(saveTripDraft); const prepareFunding = useServerFn(getReferralFundingPreparation);
  const pricingInputs = provider ? { miles, wait, discount, adjustment, reason, terms, manualConfirmed } : undefined;
  const currentReview = tripReviewKey(form, pricingInputs);
  const unchanged = !!currentReview && quoteForm === currentReview;
  const attachment = canAttachTripQuote({ currentKey: currentReview, confirmedKey: quoteForm, quoteId: confirmed?.id ?? null, draftId, referral: network }) && confirmed && draftId ? { id: confirmed.id, draftId } : null;
  const quoteInput = useMemo(() => workspaceQuoteInput(form, miles, wait), [form, miles, wait]);
  const estimateKey = quoteInput ? JSON.stringify(quoteInput) : null;
  useEffect(() => {
    if (!provider || network || preview.active || !estimateKey) { setCalculated(null); setEstimating(false); return; }
    let canceled = false;
    setCalculated(null); setEstimating(true); setEstimateMessage('');
    const timer = window.setTimeout(async () => {
      try {
        const result = await calculate({ data: { workspaceId, trip: JSON.parse(estimateKey) } });
        if (!canceled) { setCalculated(result); setEstimateMessage(''); }
      } catch (e) { if (!canceled) setEstimateMessage(e instanceof Error ? e.message : 'Not Configured — customer quote unavailable.'); }
      finally { if (!canceled) setEstimating(false); }
    }, 600);
    return () => { canceled = true; window.clearTimeout(timer); };
  }, [estimateKey, provider, network, preview.active, workspaceId, calculate]);
  const demoLines: InvoiceLine[] = [{ label: 'Pickup / loading', cents: 4000 }, { label: 'Mileage after included miles', cents: 3000 }];
  const shown = preview.active && examples && provider ? { lines: demoLines, totalCents: 7000 } : unchanged && confirmed ? confirmed : calculated;
  function tripInput() {
    if (!quoteInput) throw new Error('Enter pickup date/time and confirmed route mileage first.');
    return quoteInput;
  }
  async function recalculate() {
    if (preview.active) return previewBlocked(); if (!provider) return;
    setBusy(true); try { const quote = await calculate({ data: { workspaceId, trip: tripInput() } }); setCalculated(quote); } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function confirmQuote() {
    if (preview.active) return previewBlocked(); if (!form || !manualConfirmed || !provider) return;
    if (confirmed && !window.confirm('Replace the confirmed draft quote? Its original version will remain in history.')) return;
    setBusy(true); try {
      const reviewedKey = currentReview;
      const saved = await save({ data: { draft_id: draftId, payload: form, autosaved: false } }); setDraftId(saved.id);
      const adjustments = [Number(discount) ? { kind: 'discount' as const, cents: Number(discount), reason } : null, Number(adjustment) ? { kind: 'adjustment' as const, cents: Number(adjustment), reason } : null].filter(v => v !== null);
      const quote = await confirm({ data: { workspaceId, draftId: saved.id, trip: tripInput(), mileageConfirmed: true, expectedQuoteId: confirmed?.id ?? null, replacementConfirmed: !!confirmed, adjustments, terms } });
      setConfirmed(quote); setCalculated(quote); setQuoteForm(reviewedKey); toast.success('Quote confirmed. Submit the unchanged trip to attach its invoice.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function fundingReview() {
    if (preview.active) return previewBlocked(); if (!ack) return;
    setBusy(true); try { setFunding(await prepareFunding({ data: { workspaceId, receiverCents: Number(receiver), environment: 'sandbox' } })); } catch (e) { toast.error(e instanceof Error ? e.message : 'Funding unavailable.'); } finally { setBusy(false); }
  }
  return <TripCommerceContext.Provider value={{ onChange: change, quote: attachment, business: true, submissionBlocked: network || !!confirmed && !unchanged }}>
    <div className="trip-workspace grid min-w-0 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(20rem,2fr)]">
      <div className="min-w-0"><h1 className="ds-section-title uppercase text-ds-primary">{provider ? 'Provider-owned New Trip' : 'Facility New Trip'}</h1><p className="ds-support mt-2">{provider ? 'Saved trips stay in your workspace. Network preparation is a separate choice.' : 'Responsible billing party: your facility account or an explicitly authorized payer. Provider rates stay private.'}</p><RequestForm context="portal" initialDraft={initialDraft} allowProviderSelection={!provider}/></div>
      <aside className="trip-financial-panel min-w-0 self-start border border-ds-border bg-ds-surface" aria-label={network ? 'Referral funding preparation' : 'Live invoice estimate'}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ds-border bg-ds-sky p-4"><h2 className="ds-subheading uppercase">{network ? 'Fund Referral' : 'Live Invoice'}</h2><FileText className="size-5 shrink-0 text-ds-primary"/></header>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ds-border p-4"><div className="min-w-0"><p className="ds-caption">{network ? 'Not funded' : unchanged && confirmed ? 'Confirmed Quote' : 'Estimate'}</p><span className="portal-money">{network ? funding?.totalCents != null ? money(funding.totalCents) : 'Funding required' : estimating ? 'Updating…' : shown ? money(shown.totalCents) : 'Quote required'}</span></div><DsButton variant="ghost" className="lg:hidden" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Hide details' : 'View details'}</DsButton></div>
        <div className={`${details ? 'block' : 'hidden'} space-y-5 p-4 lg:block`}>
          {preview.active && <div className="flex flex-wrap gap-2"><p className="ds-caption">Synthetic example — all financial actions blocked.</p><DsButton variant="ghost" onClick={() => setExamples(!examples)}>{examples ? 'Remove example' : 'Show example'}</DsButton></div>}
          {provider && <DsCheckbox label="Prepare a separate referral" checked={network} onChange={e => { setNetwork(e.target.checked); setFunding(null); setAck(false); setPolicyAccepted(false); }}/>} 
          {!provider ? <div className="space-y-3"><StatusPill status={unchanged && confirmed ? 'Confirmed Quote' : 'Pending'}/><p className="ds-body">{unchanged && confirmed ? `Confirmed customer quote · ${money(confirmed.totalCents)}` : 'Quote required'}</p><p className="ds-support">Responsible billing party: this facility account, with the authorized trip payer/contact retained. Your chosen provider must supply an approved customer quote. Private provider rates are not available to this account.</p><DsButton disabled={busy||preview.active||!form} onClick={async()=>{if(!form||!window.confirm('Request a trip-specific quote from the selected accepted provider?'))return;try{const saved=await save({data:{draft_id:draftId,payload:form,autosaved:false}});setDraftId(saved.id);await requestFacility({data:{draftId:saved.id,confirmed:true}});toast.success('Quote requested in portal. No message or invoice sent.');}catch{toast.error('Choose an accepted provider and complete the trip first.');}}}>Request provider quote</DsButton><FacilityBillingReview workspaceId={workspaceId} draftId={draftId} onAccepted={d=>{const quotes=Array.isArray(d.customer_quote_history)?d.customer_quote_history as Quote[]:[];setConfirmed(quotes.at(-1)??null);setQuoteForm(tripReviewKey(d.payload));}}/>{unchanged && confirmed && <><ul className="divide-y divide-ds-border">{confirmed.lines.map((line,i)=><li key={i} className="flex justify-between gap-3 py-3"><span className="ds-body">{line.label}</span><span className="portal-money shrink-0">{money(line.cents)}</span></li>)}</ul><p className="ds-caption">Quote version {confirmed.version} · Facility agreement confirmed for this unchanged trip.</p></>}<p className="ds-caption">PDF, invoice email and payment are unavailable in this preparation. No invoice sent or payment collected.</p></div> : network ? <>
            <p className="ds-support">Service, general route and compensation only. Patient identity remains protected under existing assignment rules. Receiver compensation is never reduced by platform fees.</p><p className="ds-support">Payer: sending provider workspace · Merchant: MY FLORIDA NEMT · One-time funding · USD. Amounts below are preparation only; missing processing configuration blocks acceptance and payment.</p>
            <DsField label="Proposed receiver compensation (cents)">{p => <DsInput {...p} type="number" min="1" step="1" value={receiver} onChange={e => {setReceiver(e.target.value);setFunding(null);setPolicyAccepted(false);setAck(false);}}/>}</DsField>
            <dl className="space-y-2 ds-body"><div className="flex justify-between gap-3"><dt>Network fee (2%)</dt><dd className="portal-money">{funding ? money(funding.networkFeeCents) : 'Not prepared'}</dd></div><div className="flex justify-between gap-3"><dt>Processing recovery</dt><dd className="portal-money">{funding?.processingCents != null ? money(funding.processingCents) : 'Configuration required'}</dd></div><div className="flex justify-between gap-3"><dt>Customer invoice / retained amount</dt><dd>No invoice issued</dd></div><div className="flex justify-between gap-3"><dt>Sender margin</dt><dd>Not available</dd></div></dl>
            <p role="note" className="ds-body border-y border-ds-border py-4 font-semibold">{warning}</p><DsCheckbox label="I confirm the compensation and payment responsibility" checked={ack} onChange={e => setAck(e.target.checked)}/><CheckoutAcknowledgment accepted={policyAccepted} onChange={setPolicyAccepted}/><DsButton disabled={!ack || !policyAccepted || busy} onClick={fundingReview}>Review funding preparation</DsButton>{funding && <p className="ds-support">{funding.blocker}</p>}<p className="ds-caption">Not funded · No offer sent · Hold: standard 10 days, Super/Gold Verified 4 days. Existing 24-hour dispute window and payment deadlines are unchanged.</p><Link to="/portal/network" className="ds-label text-ds-link underline">Open controlled Network offers</Link>
          </> : <>
            <DsField label="MANUAL MILEAGE — total billable route miles">{p => <DsInput {...p} type="number" min="0" step="0.1" value={miles} onChange={e => { setMiles(e.target.value); setManualConfirmed(false); setCalculated(null); setQuoteForm(null); }}/>}</DsField>
            <DsCheckbox label="I confirm these are actual route miles, including applicable return travel" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)}/>
            <DsField label="Wait time (minutes)">{p => <DsInput {...p} type="number" min="0" value={wait} onChange={e => { setWait(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsButton variant="secondary" disabled={busy} onClick={recalculate}><RefreshCw className="size-4"/>Calculate quote</DsButton>
            {estimateMessage && <p role="status" className="ds-support">Not Configured · {estimateMessage}</p>}
            {shown && <ul className="divide-y divide-ds-border">{shown.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-3 ds-body"><span>{l.label}{l.reason && <small className="block ds-caption">{l.reason}</small>}</span><span className="portal-money shrink-0">{money(l.cents)}</span></li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-2"><DsField label="Discount (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={discount} onChange={e => { setDiscount(e.target.value); setQuoteForm(null); }}/>}</DsField><DsField label="Adjustment (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={adjustment} onChange={e => { setAdjustment(e.target.value); setQuoteForm(null); }}/>}</DsField></div>
            <DsField label="Adjustment / discount reason">{p => <DsInput {...p} value={reason} onChange={e => { setReason(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsField label="Provider cancellation / no-show policy and exact disclosed charges">{p => <DsTextarea {...p} value={terms} maxLength={3000} onChange={e => { setTerms(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <p className="ds-support">Return travel uses the confirmed total mileage; pickup charges follow your active round-trip rate. Wait time, after-hours and supported extras use only configured rates. Taxes and processing: Not Configured — not applied.</p>
            {(Number(discount) !== 0 || Number(adjustment) !== 0) && !unchanged && <p className="ds-caption">The live estimate excludes pending adjustments. Confirm the authorized adjustment and its reason to retain the exact adjusted quote.</p>}
            <p className="ds-caption">Download PDF, Email Invoice and Pay Now are unavailable here until an invoice is issued and the respective secure connection is enabled. No invoice sent or payment collected.</p>
            {calculated?.pricingSnapshot && <p className="ds-caption">Customer pricing version {calculated.pricingSnapshot.version} · USD</p>}
            <DsButton disabled={preview.active || busy || !manualConfirmed || !quoteInput} onClick={confirmQuote}>{confirmed ? 'Confirm replacement quote' : 'Confirm quote snapshot'}</DsButton>
            <FacilityQuoteInbox workspaceId={workspaceId}/>
            {confirmed && <p className="ds-support">Quote version {confirmed.version} · {unchanged ? 'Confirmed for this trip' : 'Trip or price inputs changed — confirm replacement before attaching invoice'}</p>}
          </>}
        </div>
      </aside>
    </div>
  </TripCommerceContext.Provider>;
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { toast } from 'sonner';
import { FileText, RefreshCw, ChevronDown, CreditCard, Download, X } from 'lucide-react';
import {previewDraftInvoice} from '@/lib/draft-invoice.functions';
import {FacilityQuoteInbox} from './FacilityQuoteInbox';
import {requestFacilityQuote} from '@/lib/facility-billing.functions';
import { FacilityBillingReview } from './FacilityBillingReview';
import { CheckoutAcknowledgment } from '@/components/payments/CheckoutAcknowledgment';
import { RequestForm } from '@/components/requests/RequestForm';
import { TripCommerceContext, type CommerceFormData } from '@/components/requests/trip-commerce-context';
import { DsButton, DsCheckbox, DsField, DsInput, DsTextarea } from '@/components/ds/controls';
import { confirmTripCustomerQuote, getReferralFundingPreparation } from '@/lib/trip-invoices.functions';
import { calculateProviderCustomerQuote } from '@/lib/provider-customer-pricing.functions';
import { appendInvoiceAdjustments } from '@/lib/trip-invoice-rules';
import { workspaceQuoteInput, tripReviewKey, canAttachTripQuote } from '@/lib/trip-workspace-review';
import { saveTripDraft } from '@/lib/trip-drafts.functions';
import { usePortalPreview, previewBlocked } from './preview-data';
import { StatusPill } from '@/components/ds/status';
import type { InvoiceLine, TripInvoice } from '@/lib/trip-invoice-rules';
import { REGIONAL_DEMO_INVOICE } from './demo-fixtures/regional-invoice';
import { TripInvoiceDetails } from './TripInvoiceDetails';
import { regionalInvoiceProjection } from '@/lib/regional-projections';
import { tripTimeEvidence } from '@/lib/regional-trip-times';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TripLegsPreview } from '@/components/trips/TripLegsPreview';
const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const warning = 'Warning: You are responsible for paying for trips you send to other providers. Failure to pay may result in the loss of your verification status, account suspension, or removal from the platform.';
type Quote = { id: string; lines: InvoiceLine[]; totalCents: number; version: number; rateVersion?: number; terms?: string; trip?: {miles?:number;waitMinutes?:number}; pricingSnapshot?: {version:number} };
export function NewTripWorkspace({ workspaceId, provider, patient = false, initialDraft }: { workspaceId: string; provider: boolean; patient?: boolean; initialDraft?: { id: string; payload: Record<string, unknown>; quoteHistory?: unknown } }) {
  const draftPreview=useServerFn(previewDraftInvoice);
  const [minimized, setMinimized] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(initialDraft?.payload.showInvoiceToLinkedAccount !== false);
  const [invoicePreview,setInvoicePreview]=useState<TripInvoice|null>(null);
  const preview = usePortalPreview(); const [form, setForm] = useState<CommerceFormData | null>(null);
  const change = useCallback((value: CommerceFormData) => setForm(value), []);
  const retainedHistory=Array.isArray(initialDraft?.quoteHistory)?initialDraft.quoteHistory as Quote[]:[];
  const retainedQuote=retainedHistory.at(-1);
  const [miles, setMiles] = useState(retainedQuote?.trip?.miles == null ? '' : String(retainedQuote.trip.miles)); const [wait, setWait] = useState(String(retainedQuote?.trip?.waitMinutes ?? 0)); const [manualConfirmed, setManualConfirmed] = useState(false);
  const [terms, setTerms] = useState(retainedQuote?.terms ?? ''); const [discount, setDiscount] = useState('0'); const [adjustment, setAdjustment] = useState('0'); const [reason, setReason] = useState('');
  const [policyAccepted,setPolicyAccepted]=useState(false);
  const [network, setNetwork] = useState(false); const [receiver, setReceiver] = useState(''); const [ack, setAck] = useState(false); const [busy, setBusy] = useState(false);
  const history = Array.isArray(initialDraft?.quoteHistory) ? initialDraft.quoteHistory as Quote[] : [];
  const [confirmed, setConfirmed] = useState<Quote | null>(retainedQuote ?? null); const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  // Resumed snapshots stay historical until the current trip AND mileage/adjustments are confirmed.
  const [quoteForm, setQuoteForm] = useState<string | null>(null);
  const [calculated, setCalculated] = useState<{ lines: InvoiceLine[]; totalCents: number; pricingSnapshot?: {version:number} } | null>(null);
  const [funding, setFunding] = useState<{ networkFeeCents: number; processingCents: number | null; totalCents: number | null; blocker: string; policyVersion: number | null } | null>(null);
  const [details, setDetails] = useState(false); const [examples, setExamples] = useState(preview.examples !== false);
  const [estimateMessage, setEstimateMessage] = useState('');
  const [estimating, setEstimating] = useState(false);
  const requestFacility=useServerFn(requestFacilityQuote);
  const calculate = useServerFn(calculateProviderCustomerQuote); const confirm = useServerFn(confirmTripCustomerQuote); const save = useServerFn(saveTripDraft); const prepareFunding = useServerFn(getReferralFundingPreparation);
  const pricingInputs = provider ? { miles, wait, discount, adjustment, reason, terms, manualConfirmed } : undefined;
  const baseReview = tripReviewKey(form, pricingInputs);
  const currentReview = baseReview && provider ? JSON.stringify([baseReview, showInvoice]) : baseReview;
  const unchanged = !!currentReview && quoteForm === currentReview;
  const attachment = canAttachTripQuote({ currentKey: currentReview, confirmedKey: quoteForm, quoteId: confirmed?.id ?? null, draftId, referral: network }) && confirmed && draftId ? { id: confirmed.id, draftId } : null;
  const quoteInput = useMemo(() => workspaceQuoteInput(form, miles, wait), [form, miles, wait]);
  const selectedPayer=form&&'payerId'in form?form.payerId??null:null;
  const estimateKey = quoteInput ? JSON.stringify({...quoteInput,payerId:selectedPayer}) : null;
  useEffect(() => {
    if (!provider || network || preview.active || !estimateKey) { setCalculated(null); setEstimating(false); return; }
    let canceled = false;
    setCalculated(null); setEstimating(true); setEstimateMessage('');
    const timer = window.setTimeout(async () => {
      try {
        const {payerId,...trip}=JSON.parse(estimateKey);const result = await calculate({ data: { workspaceId, trip,payerId } });
        if (!canceled) { setCalculated(result); setEstimateMessage(''); }
      } catch (e) { if (!canceled) setEstimateMessage(e instanceof Error ? e.message : 'Not Configured — customer quote unavailable.'); }
      finally { if (!canceled) setEstimating(false); }
    }, 600);
    return () => { canceled = true; window.clearTimeout(timer); };
  }, [estimateKey, provider, network, preview.active, workspaceId, calculate]);
  const demoLines: InvoiceLine[] = [{ label: 'Pickup / loading', cents: 4000 }, { label: 'Mileage after included miles', cents: 3000 }];
  let adjustedEstimate=calculated;
  try {if(calculated)adjustedEstimate={...calculated,...appendInvoiceAdjustments(calculated.lines,[...(Number(discount)?[{kind:'discount' as const,cents:Number(discount),reason}]:[]),...(Number(adjustment)?[{kind:'adjustment' as const,cents:Number(adjustment),reason}]:[])])};}catch{adjustedEstimate=null;}
  const shown = preview.active && examples && provider ? { lines: demoLines, totalCents: 7000 } : unchanged && confirmed ? confirmed : adjustedEstimate;
  function tripInput() {
    if (!quoteInput) throw new Error('Enter pickup date/time and confirmed route mileage first.');
    return quoteInput;
  }
  async function recalculate() {
    if (preview.active) return previewBlocked(); if (!provider) return;
    setBusy(true); try { const quote = await calculate({ data: { workspaceId, trip: tripInput(),payerId:selectedPayer } }); setCalculated(quote); } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function confirmQuote() {
    if (preview.active) return previewBlocked(); if (!form || !manualConfirmed || !provider) return;
    if (confirmed && !window.confirm('Replace the confirmed draft quote? Its original version will remain in history.')) return;
    setBusy(true); try {
      const reviewedKey = currentReview;
      const saved = await save({ data: { draft_id: draftId, payload: { ...initialDraft?.payload, ...form, ...(provider ? {showInvoiceToLinkedAccount: showInvoice} : {}) }, autosaved: false } }); setDraftId(saved.id);
      const adjustments = [Number(discount) ? { kind: 'discount' as const, cents: Number(discount), reason } : null, Number(adjustment) ? { kind: 'adjustment' as const, cents: Number(adjustment), reason } : null].filter(v => v !== null);
      const quote = await confirm({ data: { workspaceId, draftId: saved.id, trip: tripInput(), mileageConfirmed: true, expectedQuoteId: confirmed?.id ?? null, replacementConfirmed: !!confirmed, adjustments, terms } });
      setConfirmed(quote); setCalculated(quote); setQuoteForm(reviewedKey); toast.success('Quote confirmed. Submit the unchanged trip to attach its invoice.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Quote unavailable.'); } finally { setBusy(false); }
  }
  async function invoiceAction(pdf:boolean){if(preview.active||!draftId)return;try{const result=await draftPreview({data:{draftId,pdf}});setInvoicePreview(result.invoice);if(result.base64){const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='draft-invoice.pdf';a.click();URL.revokeObjectURL(url);}}catch(e){toast.error(e instanceof Error?e.message:'Draft invoice unavailable.');}}
  async function fundingReview() {
    if (preview.active) return previewBlocked(); if (!ack) return;
    setBusy(true); try { setFunding(await prepareFunding({ data: { workspaceId, receiverCents: Number(receiver), environment: 'sandbox' } })); } catch (e) { toast.error(e instanceof Error ? e.message : 'Funding unavailable.'); } finally { setBusy(false); }
  }
  const invoice = (
      <aside className={`trip-financial-panel min-w-0 border border-ds-border bg-ds-surface ${provider ? "provider-live-invoice" : ""}`} aria-label={network ? 'Referral funding preparation' : 'Live invoice estimate'}>
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ds-border bg-ds-sky px-4 py-3"><h2 className="ds-subheading uppercase">{network ? 'Fund Referral' : 'Live Invoice'}</h2>{provider ? <DsButton type="button" variant="ghost" size="sm" aria-label="Minimize live invoice" onClick={()=>setMinimized(true)}><X className="size-4"/></DsButton> : <FileText className="size-5 shrink-0 text-ds-primary"/>}</header>
        {!provider && <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-ds-border p-4"><div className="min-w-0"><p className="ds-caption">{preview.active && examples ? 'Preview invoice — not issued' : unchanged && confirmed ? 'Confirmed Quote' : 'Estimate'}</p><span className="portal-money">{preview.active && examples ? money(REGIONAL_DEMO_INVOICE.totalCents) : 'Provider quote required'}</span></div><DsButton type="button" variant="ghost" className="lg:hidden" onClick={() => setDetails(!details)} aria-expanded={details}>{details ? 'Hide details' : 'View details'}</DsButton></div>}
        {provider && <div className="invoice-summary grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><p className="ds-caption">{network ? 'Not funded' : unchanged && confirmed ? 'Confirmed quote' : 'Estimate — not issued'}</p><span className="portal-money">{network ? funding?.totalCents != null ? money(funding.totalCents) : 'Funding required' : estimating ? 'Updating…' : shown ? money(shown.totalCents) : provider ? 'Confirmed mileage and configured pricing required' : 'Provider quote required'}</span><p className="ds-caption mt-1">{provider ? manualConfirmed ? `${miles} confirmed route miles` : 'Enter and confirm actual route mileage' : 'Provider mileage required'} · {form && 'tripType' in form ? form.tripType === 'round_trip' ? 'Round trip' : form.tripType === 'multi_trip' ? 'Multi-leg' : 'One way' : 'Medical delivery'}</p>{confirmed && !unchanged && <p role="status" className="ds-caption mt-1">Trip or pricing changed — refresh and reconfirm the quote.</p>}</div>
          <div className="flex flex-wrap items-center gap-2 sm:max-w-sm sm:justify-end">
            {provider && <><DsButton type="button" variant="secondary" disabled={preview.active||!unchanged||!confirmed||!draftId} onClick={()=>invoiceAction(true)}><Download className="size-4"/>Download PDF</DsButton><DsButton type="button" variant="secondary" onClick={()=>setPaymentOpen(true)}><CreditCard className="size-4"/>Pay by Credit Card</DsButton></>}
            <DsButton type="button" variant="ghost" onClick={() => setDetails(!details)} aria-expanded={details} aria-controls="live-invoice-details"><ChevronDown className={`size-4 ${details ? 'rotate-180' : ''}`} aria-hidden/>Invoice details</DsButton>
          </div>
          {provider && <div className="sm:col-span-2"><DsCheckbox label="Show invoice to linked patient/facility" checked={showInvoice} onChange={e=>setShowInvoice(e.target.checked)}/><p className="ds-caption">Invoice only; authorized trip access is unchanged. Retained when the draft quote is saved.</p></div>}
        </div>}
        <div id="live-invoice-details" className={`${details ? 'block' : 'hidden'} ${provider ? '' : 'md:block'} space-y-5 p-4 border-t border-ds-border`}>
          {provider && form && 'tripType' in form && <TripLegsPreview title="Trip Review" legs={[{label:'Pickup',from:form.pickupAddress,to:form.dropoffAddress,date:form.pickupDate,time:form.pickupTime,note:`${form.transportType} · Drop-off ${form.dropoffDate||form.pickupDate} ${form.dropoffTime||'Time not supplied'}`},...(form.tripType==='round_trip'?[{label:'Return',from:form.dropoffAddress,to:form.pickupAddress,date:form.returnDate||form.pickupDate,time:form.returnPickupTime||''}]:[])]}/>}
          {preview.active && <div className="flex flex-wrap gap-2"><p className="ds-caption">Preview example — financial actions unavailable.</p><DsButton type="button" variant="ghost" onClick={() => setExamples(!examples)}>{examples ? 'Remove example' : 'Show example'}</DsButton></div>}
          {preview.active && preview.examples !== false && examples && !provider && <TripInvoiceDetails invoice={{...REGIONAL_DEMO_INVOICE, billTo: patient ? 'Pat Patient (Demo)' : 'Demo Facility', regionalContext: form ? regionalInvoiceProjection({...form,events:tripTimeEvidence(form)}) : REGIONAL_DEMO_INVOICE.regionalContext}}/>}
          {provider && <DsCheckbox label="Referral funding — available after an owned trip exists" disabled checked={network} onChange={e => { setNetwork(e.target.checked); setFunding(null); setAck(false); setPolicyAccepted(false); }}/>}
          {!provider ? <div className="space-y-3"><StatusPill status={unchanged && confirmed ? 'Confirmed Quote' : 'Pending'}/><p className="ds-body">{unchanged && confirmed ? `Confirmed customer quote · ${money(confirmed.totalCents)}` : 'Quote required'}</p><p className="ds-support">Responsible billing party: this facility account, with the authorized trip payer/contact retained. Your chosen provider must supply an approved customer quote. Private provider rates are not available to this account.</p><DsButton type="button" disabled={busy||preview.active||!form} onClick={async()=>{if(!form||!window.confirm('Request a trip-specific quote from the selected accepted provider?'))return;try{const saved=await save({data:{draft_id:draftId,payload:{...initialDraft?.payload,...form},autosaved:false}});setDraftId(saved.id);await requestFacility({data:{draftId:saved.id,confirmed:true}});toast.success('Quote requested in portal. No message or invoice sent.');}catch{toast.error('Choose an accepted provider and complete the trip first.');}}}>Request provider quote</DsButton><FacilityBillingReview workspaceId={workspaceId} draftId={draftId} onAccepted={d=>{const quotes=Array.isArray(d.customer_quote_history)?d.customer_quote_history as Quote[]:[];setConfirmed(quotes.at(-1)??null);setQuoteForm(tripReviewKey(d.payload));}}/>{unchanged && confirmed && <><ul className="divide-y divide-ds-border">{confirmed.lines.map((line,i)=><li key={i} className="flex justify-between gap-3 py-3"><span className="ds-body">{line.label}</span><span className="portal-money shrink-0">{money(line.cents)}</span></li>)}</ul><p className="ds-caption">Quote version {confirmed.version} · Facility agreement confirmed for this unchanged trip.</p></>}<p className="ds-caption">PDF, invoice email and payment are unavailable in this preparation. No invoice sent or payment collected.</p></div> : network ? <>
            <p className="ds-support">Service, general route and compensation only. Patient identity remains protected under existing assignment rules. Receiver compensation is never reduced by platform fees.</p><p className="ds-support">Payer: sending provider workspace · Merchant: MY FLORIDA NEMT · One-time funding · USD. Amounts below are preparation only; missing processing configuration blocks acceptance and payment.</p>
            <DsField label="Proposed receiver compensation (cents)">{p => <DsInput {...p} type="number" min="1" step="1" value={receiver} onChange={e => {setReceiver(e.target.value);setFunding(null);setPolicyAccepted(false);setAck(false);}}/>}</DsField>
            <dl className="space-y-2 ds-body"><div className="flex justify-between gap-3"><dt>Network fee (2%)</dt><dd className="portal-money">{funding ? money(funding.networkFeeCents) : 'Not prepared'}</dd></div><div className="flex justify-between gap-3"><dt>Processing recovery</dt><dd className="portal-money">{funding?.processingCents != null ? money(funding.processingCents) : 'Configuration required'}</dd></div><div className="flex justify-between gap-3"><dt>Customer invoice / retained amount</dt><dd>No invoice issued</dd></div><div className="flex justify-between gap-3"><dt>Sender margin</dt><dd>Not available</dd></div></dl>
            <p role="note" className="ds-body border-y border-ds-border py-4 font-semibold">{warning}</p><DsCheckbox label="I confirm the compensation and payment responsibility" checked={ack} onChange={e => setAck(e.target.checked)}/><CheckoutAcknowledgment accepted={policyAccepted} onChange={setPolicyAccepted}/><DsButton type="button" disabled={!ack || !policyAccepted || busy} onClick={fundingReview}>Review funding preparation</DsButton>{funding && <p className="ds-support">{funding.blocker}</p>}<p className="ds-caption">Not funded · No offer sent · Hold: standard 10 days, Super/Gold Verified 4 days. Existing 24-hour dispute window and payment deadlines are unchanged.</p><Link to="/portal/network" className="ds-label text-ds-link underline">Open controlled Network offers</Link>
          </> : <>
            <DsField label="MANUAL MILEAGE — total billable route miles">{p => <DsInput {...p} type="number" min="0" step="0.1" value={miles} onChange={e => { setMiles(e.target.value); setManualConfirmed(false); setCalculated(null); setQuoteForm(null); }}/>}</DsField>
            <DsCheckbox label="I confirm these are actual route miles, including applicable return travel" checked={manualConfirmed} onChange={e => setManualConfirmed(e.target.checked)}/>
            <DsField label="Wait time (minutes)">{p => <DsInput {...p} type="number" min="0" value={wait} onChange={e => { setWait(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsButton type="button" variant="secondary" disabled={busy} onClick={recalculate}><RefreshCw className="size-4"/>Calculate quote</DsButton>
            {estimateMessage && <p role="status" className="ds-support">Pricing setup required · {estimateMessage}</p>}
            {shown && <ul className="divide-y divide-ds-border">{shown.lines.map((l, i) => <li key={i} className="flex justify-between gap-3 py-3 ds-body"><span>{l.label}{l.reason && <small className="block ds-caption">{l.reason}</small>}</span><span className="portal-money shrink-0">{money(l.cents)}</span></li>)}</ul>}
            <div className="grid gap-3 sm:grid-cols-2"><DsField label="Discount (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={discount} onChange={e => { setDiscount(e.target.value); setQuoteForm(null); }}/>}</DsField><DsField label="Adjustment (integer cents)">{p => <DsInput {...p} type="number" min="0" step="1" value={adjustment} onChange={e => { setAdjustment(e.target.value); setQuoteForm(null); }}/>}</DsField></div>
            <DsField label="Adjustment / discount reason">{p => <DsInput {...p} value={reason} onChange={e => { setReason(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <DsField label="Provider cancellation / no-show policy and exact disclosed charges">{p => <DsTextarea {...p} value={terms} maxLength={3000} onChange={e => { setTerms(e.target.value); setQuoteForm(null); }}/>}</DsField>
            <p className="ds-support">Return travel uses the confirmed total mileage; pickup charges follow your active round-trip rate. Wait time, after-hours and supported extras use only configured rates. Taxes and processing: Not Configured — not applied.</p>
            {(Number(discount) !== 0 || Number(adjustment) !== 0) && !unchanged && <p className="ds-caption">Adjustments require a valid amount and reason. This remains estimated until the exact adjusted quote is confirmed.</p>}
            <p className="ds-caption">Draft PDF requires a current confirmed quote. Invoice delivery and secure card collection remain disabled.</p>
            {calculated?.pricingSnapshot && <p className="ds-caption">Customer pricing version {calculated.pricingSnapshot.version} · USD</p>}
            <DsButton type="button" disabled={preview.active || busy || !manualConfirmed || !quoteInput} onClick={confirmQuote}>{confirmed ? 'Confirm replacement quote' : 'Confirm quote snapshot'}</DsButton>
            <details><summary className="ds-label cursor-pointer">Facility quote requests</summary><FacilityQuoteInbox workspaceId={workspaceId}/></details>
            {confirmed && <p className="ds-support">Quote version {confirmed.version} · {unchanged ? 'Confirmed for this trip' : 'Trip or price inputs changed — confirm replacement before attaching invoice'}</p>}
            {history.length > 0 && <details><summary className="ds-label cursor-pointer">Retained quote history</summary><ul className="divide-y divide-ds-border">{history.map((quote,index)=><li key={quote.id ?? index} className="ds-support flex justify-between gap-3 py-2"><span>Version {quote.version} · Pricing version {quote.rateVersion ?? quote.pricingSnapshot?.version ?? 'Retained'}</span><span className="portal-money">{money(quote.totalCents)}</span></li>)}</ul></details>}
          </>}
          {!network && <section className="space-y-3 border-t border-ds-border pt-4"><h3 className="ds-label">Draft invoice</h3><div className="flex flex-wrap gap-2"><DsButton type="button" variant="secondary" disabled={preview.active||!unchanged||!confirmed||!draftId} onClick={()=>invoiceAction(false)}>Preview invoice</DsButton><DsButton type="button" variant="secondary" disabled={preview.active||!unchanged||!confirmed||!draftId} onClick={()=>invoiceAction(true)}>Download draft PDF</DsButton><DsButton type="button" variant="ghost" disabled={preview.active||!unchanged||!confirmed} onClick={()=>toast.success('The reviewed draft invoice is already saved with this trip draft.')}>Save draft invoice</DsButton><DsButton type="button" disabled title="External invoice delivery remains off">Send invoice — delivery off</DsButton></div>{invoicePreview&&unchanged&&<div role="status" className="space-y-2"><p className="ds-label">DRAFT — NOT ISSUED · {invoicePreview.billTo}</p>{invoicePreview.lines.map((line,i)=><p key={i} className="ds-body flex justify-between gap-2"><span>{line.label}</span><span>{money(line.cents)}</span></p>)}<p className="portal-money">{money(invoicePreview.totalCents)}</p></div>}<p className="ds-caption">A reviewed quote is required for preview and PDF. Issued invoices remain linked to the submitted trip.</p></section>}
        </div>
      </aside>
  );
  return <TripCommerceContext.Provider value={{ onChange: change, draftId, onDraftSaved: setDraftId, quote: attachment, business: true, provider, submissionBlocked: network || !!confirmed && !unchanged, ...(provider ? {workspaceId, invoiceSlot: minimized ? null : invoice, invoiceBottomSlot: minimized ? <div className="provider-invoice-minimized border border-ds-border bg-ds-sky p-3 flex flex-wrap justify-between items-center gap-3"><span className="ds-label">Live Invoice · {shown ? money(shown.totalCents) : 'Estimate unavailable'}</span><DsButton type="button" variant="secondary" aria-label="Expand live invoice" onClick={()=>{setMinimized(false);setDetails(true);}}>Invoice details<ChevronDown className="size-4"/></DsButton></div> : null, draftExtras: {showInvoiceToLinkedAccount: showInvoice}} : {}) }}>
    <div className={`trip-workspace min-w-0 ${provider ? 'provider-trip-document bg-ds-surface p-4 sm:p-5 lg:p-6' : `grid gap-6 ${patient ? '' : 'md:grid-cols-2'}`}`}>
      <div className="min-w-0"><h1 className="sr-only">New trip</h1><RequestForm context="portal" initialDraft={initialDraft} allowProviderSelection={!provider}/></div>
      {!provider && invoice}
    </div>
    <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}><DialogContent className="provider-trip-dialog theme-portal"><DialogTitle>Secure invoice payment</DialogTitle><DialogDescription>Secure invoice collection is not enabled. An issued invoice, approved Stripe/payment configuration, account binding and payment-policy approval are required. This draft is not a payable invoice. No payment was created and no card information is collected.</DialogDescription><DsButton type="button" variant="secondary" onClick={()=>setPaymentOpen(false)}>Close</DsButton></DialogContent></Dialog>
  </TripCommerceContext.Provider>;
}
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Network, Send, X, MessageSquare, AlertTriangle } from 'lucide-react';
import { DsButton, DsCheckbox, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { usePortalQuery, usePortalMutation } from '@/components/portal/preview-data';
import { listNetworkOffers, listNetworkActivity, acceptNetworkOffer, respondNetworkOffer, createNetworkDistribution, sendNetworkWave, getDistributionReadiness, getNetworkSettings, saveNetworkSettings, markNetworkAttention, getOfferHistory, type NetworkOffer } from '@/lib/trip-network.functions';
import { nextRadius, PAYMENT_RESPONSIBILITY_WARNING } from '@/lib/trip-network-rules';
import { DetailOverlayFrame } from './DetailOverlayFrame';
import { useRequestDetails } from './request-detail-context';

const money = (c: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
const label = (s: string) => s.replaceAll('_', ' ');
function useRefreshNetwork() {
  const qc = useQueryClient();
  return () => ['network-offers', 'network-activity', 'reservations-by-state', 'day-reservations', 'schedule-board', 'request-overlay'].forEach(key => qc.invalidateQueries({ queryKey: [key] }));
}
function OfferResponse({ offer, source = false, onClose }: { offer: NetworkOffer; source?: boolean; onClose: () => void }) {
  const accept = useServerFn(acceptNetworkOffer), respond = useServerFn(respondNetworkOffer);
  const refresh = useRefreshNetwork();
  const historyFn=useServerFn(getOfferHistory);
  const history=usePortalQuery({queryKey:['offer-history',offer.id],queryFn:()=>historyFn({data:{offer_id:offer.id}})});
  const [mode, setMode] = useState<'review' | 'counter' | 'decline' | 'revise'>('review');
  const [amount, setAmount] = useState(String(offer.amount_cents / 100));
  const [note, setNote] = useState('');
  const [expires, setExpires] = useState('');
  const [reason, setReason] = useState('');
  const m = usePortalMutation({ mutationFn: async (action: 'accept' | 'counter' | 'decline' | 'revise' | 'reject_counter') => {
    const r = action === 'accept' ? await accept({ data: { offer_id: offer.id, approve_counter: source } }) : await respond({ data: { offer_id: offer.id, action, ...(action === 'counter' || action === 'revise' ? { amount_cents: Math.round(Number(amount) * 100), expires_at: new Date(expires).toISOString() } : {}), business_note: note || undefined, reason: (reason || undefined) as 'no_driver' | undefined } });
    if (!r.ok) throw new Error(r.error || 'This offer is no longer available');
  }, onSuccess: () => { toast.success('Offer response recorded.'); refresh(); onClose(); }, onError: (e: Error) => toast.error(e.message) });
  return <DetailOverlayFrame title="Offer details" onClose={onClose}>
    <div className="space-y-5">
      <div className="flex justify-between gap-4"><h2 className="ds-subheading text-ds-primary">{offer.mfn_id}</h2><DsButton variant="ghost" size="sm" aria-label="Close offer review" onClick={onClose}><X className="size-4" /></DsButton></div>
      <dl className="grid grid-cols-2 gap-3 ds-body"><dt>Source</dt><dd className="break-all font-mono">{offer.source_mfn_id}</dd><dt>General route</dt><dd>{offer.pickup_area} → {offer.destination_area}</dd><dt>When</dt><dd>{offer.pickup_date} {offer.pickup_time}</dd><dt>Service / trip</dt><dd>{label(offer.service_type || offer.capability)} · {label(offer.trip_type || '')}</dd><dt>Capability</dt><dd>{offer.capability}</dd><dt>Compensation</dt><dd>{money(offer.amount_cents)}</dd><dt>Expires</dt><dd>{new Date(offer.expires_at).toLocaleString()}</dd></dl>
      <p className="ds-support text-ds-muted">Passenger identity and exact trip details remain protected until assignment.</p>
      <details><summary className="ds-label cursor-pointer">Negotiation history</summary>{(history.data??[]).map(h=><p className="ds-support mt-2" key={h.id}>{h.side} · {label(h.action)}{h.amount_cents?` · ${money(h.amount_cents)}`:''} · {h.business_note||'—'} · {new Date(h.created_at).toLocaleString()}</p>)}</details>
      {mode === 'review' ? <div className="flex flex-wrap gap-2">
        <DsButton disabled={m.isPending || (!source && offer.status === 'countered')} onClick={() => { if (confirm(source ? 'Approve this counteroffer and reserve the trip?' : 'Accept this compensation and reserve the trip for your business?')) m.mutate('accept'); }}><Check className="size-4" />{source ? 'Accept counteroffer' : 'Accept offer'}</DsButton>
        <DsButton variant="secondary" disabled={!source && offer.status === 'countered'} onClick={() => setMode(source ? 'revise' : 'counter')}><MessageSquare className="size-4" />{source ? 'Revise amount' : 'Counter offer'}</DsButton>
        <DsButton variant="ghost" onClick={() => setMode('decline')}><X className="size-4" />{source ? 'Decline counteroffer' : 'Decline'}</DsButton>
      </div> : <form className="space-y-4" onSubmit={e => { e.preventDefault(); m.mutate(mode === 'decline' && source ? 'reject_counter' : mode === 'decline' ? 'decline' : mode); }}>
        {mode !== 'decline' ? <><DsField label="Proposed amount ($)">{p => <DsInput {...p} type="number" min="0.01" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} />}</DsField><DsField label="Counteroffer expiration">{p => <DsInput {...p} type="datetime-local" required value={expires} onChange={e => setExpires(e.target.value)} />}</DsField></> : !source && <DsField label="Reason (optional)">{p => <DsSelect {...p} value={reason} onChange={e => setReason(e.target.value)}><option value="">No reason</option><option value="no_driver">No driver</option><option value="no_vehicle">No appropriate vehicle</option><option value="schedule">Schedule conflict</option><option value="distance">Distance</option><option value="rate">Rate</option><option value="other">Other</option></DsSelect>}</DsField>}
        <DsField label="Business note (optional)" hint="Do not include passenger, medical or payer information.">{p => <DsTextarea {...p} maxLength={300} value={note} onChange={e => setNote(e.target.value)} />}</DsField>
        <DsButton disabled={m.isPending} type="submit"><Send className="size-4" />Submit response</DsButton>
      </form>}
    </div>
  </DetailOverlayFrame>;
}
export function ProviderNetworkOffers() {
  const list = useServerFn(listNetworkOffers);
  const q = usePortalQuery({ queryKey: ['network-offers'], queryFn: () => list() });
  const [review, setReview] = useState<NetworkOffer | null>(null);
  return <div className="space-y-4">
    {q.isLoading && <p className="ds-body">Loading offers…</p>}
    {!!q.error && <p role="alert" className="text-ds-error">Could not load offers.</p>}
    {!q.isLoading && !q.error && !q.data?.length && <p className="ds-body text-ds-muted py-6">No offers addressed to your business yet.</p>}
    <div className="grid gap-4 lg:grid-cols-2">{(q.data ?? []).map(o => <article key={o.id} role="button" tabIndex={0} aria-label={`Review offer ${o.mfn_id}`} onClick={e => { if (!(e.target as HTMLElement).closest('button')) setReview(o); }} onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setReview(o); } }} className="cursor-pointer rounded-ds bg-ds-surface border border-ds-border p-5 space-y-3 focus-visible:outline-2 focus-visible:outline-ds-focus">
      <div className="flex flex-wrap justify-between gap-2"><span className="font-mono ds-support">{o.mfn_id}</span><span className="ds-label uppercase text-ds-primary">{label(o.status)}</span></div>
      <h3 className="ds-subheading text-ds-primary">{o.pickup_area} → {o.destination_area}</h3>
      <p className="ds-support font-mono">{o.source_mfn_id}</p><p className="ds-body">{o.pickup_date} · {o.pickup_time.slice(0,5)} · {label(o.trip_type)}</p>
      <p className="ds-body">{label(o.service_type)} · {o.capability}{o.estimated_miles != null ? ` · ${o.estimated_miles} miles` : ''}</p>
      <div className="flex justify-between gap-3"><strong className="ds-body">{money(o.amount_cents)}</strong><span className="ds-support text-ds-muted">{Math.max(0, Math.ceil((Date.parse(o.expires_at)-Date.now())/3600000))} hours remaining</span></div>
      <DsButton variant="secondary" onClick={() => setReview(o)} disabled={!['pending','revised','countered'].includes(o.status)}>Review offer</DsButton>
    </article>)}</div>
    {review && <OfferResponse offer={review} onClose={() => setReview(null)} />}
  </div>;
}
export function DistributionActivity({ admin = false }: { admin?: boolean }) {
  const openDetails = useRequestDetails();
  const list = useServerFn(listNetworkActivity), send = useServerFn(sendNetworkWave);
  const q = usePortalQuery({ queryKey: ['network-activity'], queryFn: () => list() });
  const [filter, setFilter] = useState('all');
  const [review, setReview] = useState<NetworkOffer | null>(null);
  const refresh = useRefreshNetwork();
  const attentionFn=useServerFn(markNetworkAttention);
  const attention=usePortalMutation({mutationFn:()=>attentionFn(),onSuccess:()=>{refresh();toast.success('Attention status recorded.');},onError:(e:Error)=>toast.error(e.message)});
  const m = usePortalMutation({ mutationFn: (id: string) => send({ data: { distribution_id: id } }), onSuccess: r => { toast.success(`${r.radius}-mile wave sent to ${r.recipients} eligible businesses.`); refresh(); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-4">
    <DsField label="Distribution status">{p => <DsSelect {...p} className="max-w-sm" value={filter} onChange={e => setFilter(e.target.value)}>{['all','ready','offers_sent','negotiating','provider_selected','needs_attention','closed','unavailable'].map(s => <option value={s} key={s}>{label(s)}</option>)}</DsSelect>}</DsField>
    {!!q.error && <p role="alert" className="text-ds-error">Could not load network activity.</p>}
    {!q.isLoading && !q.data?.length && <p className="ds-body text-ds-muted">No controlled distributions yet.</p>}
    {(q.data ?? []).filter(d => filter==='all' || d.status===filter).map(d => <details key={d.id} className="rounded-ds bg-ds-surface border border-ds-border p-5" onClick={e => { if ((e.target as HTMLElement).closest('button, input, select, textarea, summary')) return; if (d.request_id || d.trip_id) openDetails({ kind: d.request_id ? 'request' : 'trip', id: d.request_id || d.trip_id || '' }); }}>
      <summary className="cursor-pointer ds-body font-semibold text-ds-primary" onClick={e => { if (d.request_id || d.trip_id) { e.preventDefault(); openDetails({ kind: d.request_id ? 'request' : 'trip', id: d.request_id || d.trip_id || '' }); } }}>{d.status==='needs_attention' && <AlertTriangle className="inline size-4 mr-2 text-ds-error" />}{d.mfn_id} · {d.pickup_area} → {d.destination_area} · {label(d.status)}</summary>
      <DsButton variant="ghost" size="sm" className="mt-2" onClick={e => { const details = e.currentTarget.closest('details'); if (details) details.open = !details.open; }}>Distribution actions and history</DsButton>
      <div className="space-y-4 mt-4"><p className="ds-body">{d.source_business || 'Public request'} · {d.source_mfn_id} · {money(d.amount_cents)} · {d.pickup_date} {d.pickup_time}</p>
        {(d.request_id || d.trip_id) && <DsButton variant="ghost" onClick={() => openDetails({ kind: d.request_id ? 'request' : 'trip', id: d.request_id || d.trip_id || '' })}>View request details</DsButton>}
        {admin && d.can_manage && nextRadius(d.current_radius) && !['provider_selected','closed','canceled','unavailable'].includes(d.status) && <DsButton disabled={m.isPending} onClick={() => { if(confirm(`Send this distribution to eligible providers within ${nextRadius(d.current_radius)} miles?`)) m.mutate(d.id); }}><Send className="size-4" />{d.current_radius ? `Expand to ${nextRadius(d.current_radius)} miles` : 'Send first wave — 20 miles'}</DsButton>}
        {admin && d.can_manage && d.status==='needs_attention' && <DsButton variant="secondary" disabled={attention.isPending} onClick={()=>attention.mutate()}><AlertTriangle className="size-4"/>Record attention alert</DsButton>}
        <div className="ds-support space-y-2">{d.waves.map(w => <p key={w.id}>{w.radius_miles}-mile wave · {new Date(w.sent_at).toLocaleString()} · {d.offers.filter(o => o.wave_id===w.id).length} recipients</p>)}</div>
        <h3 className="ds-label text-ds-primary">Offers</h3>
        {d.offers.map(o => <div key={o.id} className="flex flex-wrap justify-between gap-2 border-t border-ds-border py-2 ds-body"><span>{o.mfn_id} · {money(o.amount_cents)} · {label(o.status)}</span>{o.status==='countered' && d.can_manage && <DsButton size="sm" variant="secondary" onClick={() => setReview({ ...o, source_mfn_id: d.source_mfn_id, pickup_area: d.pickup_area, destination_area: d.destination_area, pickup_date: d.pickup_date, pickup_time: d.pickup_time, capability: d.capability })}>Review counteroffer</DsButton>}</div>)}
        <h3 className="ds-label text-ds-primary">Negotiation history</h3>{d.negotiations.map(n => <p className="ds-support" key={n.id}>{n.side} · {label(n.action)}{n.amount_cents ? ` · ${money(n.amount_cents)}` : ''} · {n.business_note || '—'} · {new Date(n.created_at).toLocaleString()}</p>)}
        <h3 className="ds-label text-ds-primary">Audit history</h3>{d.events.map(e => <p className="ds-support" key={e.id}>{label(e.event_type)} · {e.actor_mfn_id || 'System'} · {new Date(e.created_at).toLocaleString()}</p>)}
      </div>
    </details>)}
    {review && <OfferResponse source offer={review} onClose={() => setReview(null)} />}
  </div>;
}
export function ShareTripControl({ requestId, tripId }: { requestId?: string; tripId?: string }) {
  const [open, setOpen] = useState(false), [amount, setAmount] = useState(''), [expires, setExpires] = useState('');
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const ready = useServerFn(getDistributionReadiness), create = useServerFn(createNetworkDistribution);
  const refresh = useRefreshNetwork();
  const q = usePortalQuery({ queryKey: ['network-readiness', requestId, tripId], queryFn: () => ready({ data: { request_id: requestId, trip_id: tripId } }), enabled: open });
  const m = usePortalMutation({ mutationFn: () => create({ data: { request_id: requestId, trip_id: tripId, amount_cents: Math.round(Number(amount)*100), expires_at: new Date(expires).toISOString(), payment_responsibility_confirmed: paymentConfirmed } }), onSuccess: () => { toast.success('Ready for reviewed distribution. No wave has been sent.'); refresh(); setOpen(false); setPaymentConfirmed(false); }, onError: (e: Error) => toast.error(e.message) });
  return <><DsButton variant="secondary" onClick={() => setOpen(true)}><Network className="size-4" />{requestId ? 'Send to provider network' : 'Share with network'}</DsButton>{open && <div role="dialog" aria-modal="true" aria-label="Confirm network sharing" className="fixed inset-0 z-50 flex justify-center items-center bg-ds-primary/50 p-5"><form className="max-w-xl w-full max-h-[85vh] overflow-auto bg-ds-surface rounded-ds p-6 space-y-4" onSubmit={e => { e.preventDefault(); m.mutate(); }}><div className="flex justify-between"><h2 className="ds-subheading text-ds-primary">Confirm distribution</h2><DsButton type="button" variant="ghost" aria-label="Close distribution" onClick={() => setOpen(false)}><X className="size-4" /></DsButton></div>
      {q.isLoading && <p>Checking readiness…</p>}{!!q.error && <p role="alert" className="text-ds-error">{q.error instanceof Error ? q.error.message : 'Could not check readiness.'}</p>}{q.data && <><p className="font-mono">{q.data.source_id}</p><p className="ds-body">{label(q.data.service_type)} · {q.data.pickup_area} → {q.data.destination_area}</p><p className="ds-body">{q.data.pickup_date} {q.data.pickup_time} · {label(q.data.trip_type)}{q.data.estimated_miles ? ` · ${q.data.estimated_miles} miles` : ''}</p>{q.data.missing.length>0 && <p className="text-ds-error ds-body">Missing: {q.data.missing.join(', ')}</p>}<DsField label="Provider compensation ($)">{p => <DsInput {...p} type="number" min="0.01" step="0.01" required value={amount} onChange={e=>setAmount(e.target.value)} />}</DsField><DsField label="Offer expiration">{p => <DsInput {...p} type="datetime-local" required value={expires} onChange={e=>setExpires(e.target.value)} />}</DsField><p className="ds-support text-ds-muted">Only general areas, service, time and compensation will be offered. Source ownership is retained.</p><DsButton disabled={m.isPending || q.data.missing.length>0} type="submit">Confirm ready for distribution</DsButton></>}
    </form></div>}</>;
}
export function NetworkTimingSettings() {
  const get = useServerFn(getNetworkSettings), save = useServerFn(saveNetworkSettings);
  const q = usePortalQuery({ queryKey: ['network-settings'], queryFn: () => get() });
  const [values, setValues] = useState<Record<string,string>>({});
  const m = usePortalMutation({ mutationFn: () => save({ data: { wave_50_delay_minutes: value('wave_50_delay_minutes'), wave_100_delay_minutes: value('wave_100_delay_minutes'), wave_200_delay_minutes: value('wave_200_delay_minutes') } }), onSuccess: () => toast.success('Future timing settings saved; automation remains off.'), onError: (e: Error) => toast.error(e.message) });
  function value(k: 'wave_50_delay_minutes'|'wave_100_delay_minutes'|'wave_200_delay_minutes') { const raw=values[k] ?? String(q.data?.[k] ?? ''); return raw ? Number(raw) : null; }
  return <form className="space-y-4" onSubmit={e=>{e.preventDefault();m.mutate();}}><h2 className="ds-subheading text-ds-primary">Network distribution</h2><p className="ds-body">Automatic expansion: OFF</p><div className="grid gap-4 sm:grid-cols-3">{[50,100,200].map(r=>{const key=`wave_${r}_delay_minutes` as 'wave_50_delay_minutes';return <DsField key={r} label={`${r}-mile delay (minutes)`}>{p=><DsInput {...p} type="number" min="1" value={values[key] ?? String(q.data?.[key] ?? '')} onChange={e=>setValues({...values,[key]:e.target.value})} />}</DsField>;})}</div><DsButton disabled={m.isPending} type="submit">Save future timing</DsButton></form>;
}
import { useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { listSettlements, fileSettlementDispute, getConnectReadiness, type SettlementRow } from '@/lib/network-settlements.functions';
import { createConnectOnboardingLink } from '@/lib/payouts.functions';
import { effectiveSettlementState, SETTLEMENT_LABELS, ALERT_STATES, PROCESSING_FEE_COPY, HOLD_DAYS, connectState, CONNECT_LABELS, type SettlementState } from '@/lib/network-settlement-rules';
import { usePortalQuery, usePortalMutation, usePortalPreview } from './preview-data';

const money = (c: number | null) => c == null ? 'Shown before payment' : `$${(c / 100).toFixed(2)}`;
const when = (s: string | null) => s ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) + ' ET' : '—';

/** Removable preview fixtures (synthetic, never written). */
const DEMO: SettlementRow[] = [
  { id: '00000000-0000-4000-8000-000000000001', mfn_id: 'MFN-S-DEMO01', source_mfn_id: 'MFN-R-DEMO', side: 'receiver', sender_workspace_mfn_id: 'MFN-A-DEMO1', receiver_workspace_mfn_id: 'MFN-A-DEMO2', receiver_payout_cents: 8500, network_fee_cents: 170, processing_fee_cents: null, processing_fee_rule: 'disclosed_before_payment', sender_total_due_cents: 8670, currency: 'usd', completed_at: new Date(Date.now() - 3600e3).toISOString(), review_window_ends_at: new Date(Date.now() + 23 * 3600e3).toISOString(), payment_deadline_at: new Date(Date.now() + 4 * 86400e3).toISOString(), payment_succeeded_at: null, verification_tier_snapshot: null, hold_days: null, release_eligible_at: null, dispute_opened_at: null, dispute_resolved_at: null, transferred: false, paid_out: false, stripe_environment: 'sandbox', state: 'under_review', created_at: new Date().toISOString(), events: [] },
  { id: '00000000-0000-4000-8000-000000000002', mfn_id: 'MFN-S-DEMO02', source_mfn_id: 'MFN-R-DEMO', side: 'receiver', sender_workspace_mfn_id: 'MFN-A-DEMO3', receiver_workspace_mfn_id: 'MFN-A-DEMO2', receiver_payout_cents: 12000, network_fee_cents: 240, processing_fee_cents: null, processing_fee_rule: 'disclosed_before_payment', sender_total_due_cents: 12240, currency: 'usd', completed_at: new Date(Date.now() - 5 * 86400e3).toISOString(), review_window_ends_at: null, payment_deadline_at: null, payment_succeeded_at: new Date(Date.now() - 2 * 86400e3).toISOString(), verification_tier_snapshot: 'verified', hold_days: 10, release_eligible_at: new Date(Date.now() + 8 * 86400e3).toISOString(), dispute_opened_at: null, dispute_resolved_at: null, transferred: false, paid_out: false, stripe_environment: 'sandbox', state: 'held', created_at: new Date().toISOString(), events: [] },
];

const GROUPS: { label: string; states: SettlementState[] }[] = [
  { label: 'Pending / review', states: ['pending_completion', 'under_review'] },
  { label: 'Awaiting payment', states: ['payment_due', 'overdue'] },
  { label: 'Held', states: ['held'] },
  { label: 'Available', states: ['available_for_transfer'] },
  { label: 'Transferred / paid', states: ['transferred', 'payout_pending', 'paid_out'] },
  { label: 'Disputed / failed', states: ['disputed', 'refunded', 'failed'] },
];

export function NetworkSettlements({ admin = false }: { admin?: boolean }) {
  const preview = usePortalPreview();
  const list = useServerFn(listSettlements), dispute = useServerFn(fileSettlementDispute), readiness = useServerFn(getConnectReadiness), onboard = useServerFn(createConnectOnboardingLink);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['network-settlements'], queryFn: () => list() });
  const cq = usePortalQuery({ queryKey: ['connect-readiness'], queryFn: () => readiness(), enabled: !admin });
  const rows = (preview.active ? DEMO : (q.data as SettlementRow[] | undefined)) ?? [];
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [open, setOpen] = useState<SettlementRow | null>(null);
  const [cat, setCat] = useState('completion_missing'); const [why, setWhy] = useState('');
  const filtered = useMemo(() => rows.filter(r => (!from || r.created_at >= from) && (!to || r.created_at.slice(0, 10) <= to)), [rows, from, to]);
  const withState = filtered.map(r => ({ r, s: effectiveSettlementState(r) }));
  const m = usePortalMutation({
    mutationFn: (id: string) => dispute({ data: { settlementId: id, category: cat as never, explanation: why, confirmed: true } }),
    onSuccess: () => { toast.success('Dispute opened. Payment and release are paused.'); setOpen(null); setWhy(''); qc.invalidateQueries({ queryKey: ['network-settlements'] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const cs = connectState(preview.active ? null : (cq.data as never) ?? null);

  return <div className="space-y-5">
    <p className="ds-body rounded-ds border border-ds-border bg-ds-sky p-3 text-ds-primary">This is a settlement ledger, not a bank or escrow account. Funds stay in the platform settlement flow until the hold ends; held settlements cannot be withdrawn or accelerated. Hold: Super Verified {HOLD_DAYS.super} days, all others {HOLD_DAYS.standard} days, starting after sender payment succeeds with no open dispute. {preview.active && <strong> Preview only — demo settlements.</strong>}</p>

    {!admin && <div className="flex flex-wrap items-center justify-between gap-3 rounded-ds border border-ds-border bg-ds-surface p-4">
      <div><p className="ds-label uppercase">Stripe Connect payouts (test mode)</p><p className="ds-body">Status: <strong>{CONNECT_LABELS[cs]}</strong>. Bank and identity details are entered only on Stripe’s secure pages. Standard bank payout is the default.</p><p className="ds-caption text-ds-on-subtle">Instant Payout — coming later; its fee would be paid by the receiving provider.</p></div>
      <DsButton disabled={preview.active || cs === 'enabled'} onClick={async () => { const r = await onboard(); if (r.ok) window.location.href = r.url; else toast.error(r.error); }}>{cs === 'not_started' ? 'Start onboarding' : 'Manage on Stripe'}</DsButton>
    </div>}

    <div className="flex flex-wrap items-end gap-3">
      <DsField label="From">{(fp) => <DsInput {...fp} type="date" value={from} onChange={e => setFrom(e.target.value)} />}</DsField>
      <DsField label="To">{(fp) => <DsInput {...fp} type="date" value={to} onChange={e => setTo(e.target.value)} />}</DsField>
    </div>

    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
      {GROUPS.map(g => { const items = withState.filter(x => g.states.includes(x.s)); const sum = items.reduce((a, x) => a + x.r.receiver_payout_cents, 0);
        return <div key={g.label} className="rounded-ds border border-ds-border bg-ds-surface p-3"><p className="ds-caption uppercase text-ds-on-subtle whitespace-nowrap">{g.label}</p><p className="ds-h4 tabular-nums">{money(sum)}</p><p className="ds-caption">{items.length} settlement{items.length === 1 ? '' : 's'}</p></div>; })}
    </div>

    {q.isLoading && !preview.active ? <p className="ds-body">Loading settlements…</p> : q.isError && !preview.active ? <p className="ds-body">Settlements are unavailable right now.</p> : withState.length === 0 ? <p className="ds-body">No Network settlements yet. A settlement appears when a referral is accepted.</p> :
      <ul className="space-y-2">{withState.map(({ r, s }) => <li key={r.id}>
        <button type="button" onClick={() => setOpen(r)} className="w-full text-left rounded-ds border border-ds-border bg-ds-surface p-3 hover:bg-ds-sky">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="ds-label">{r.mfn_id} <span className="ds-caption text-ds-on-subtle">· {r.side === 'receiver' ? `from ${r.sender_workspace_mfn_id}` : `to ${r.receiver_workspace_mfn_id}`}</span></span>
            <span className={`ds-caption rounded-ds px-2 py-0.5 border whitespace-nowrap ${ALERT_STATES.includes(s) ? 'border-ds-error text-ds-error' : 'border-ds-border'}`}>{SETTLEMENT_LABELS[s]}</span>
          </div>
          <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 ds-caption tabular-nums">
            <span>Payout <strong>{money(r.receiver_payout_cents)}</strong></span>
            <span>Pay by {when(r.payment_deadline_at)}</span>
            <span>Release {when(r.release_eligible_at)}</span>
            <span>Hold {r.hold_days ? `${r.hold_days} days` : '—'}</span>
          </div>
        </button></li>)}</ul>}

    {open && <div role="dialog" aria-modal="true" aria-label={`Settlement ${open.mfn_id}`} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ds-on-bg/40 p-4">
      <div className="w-full max-w-4xl rounded-ds border border-ds-border bg-ds-surface p-5 space-y-4">
        <div className="flex items-center justify-between gap-3"><h3 className="ds-h4">Settlement {open.mfn_id}</h3><DsButton variant="ghost" onClick={() => setOpen(null)}>Close</DsButton></div>
        <div className="grid gap-3 md:grid-cols-3">
          <section className="rounded-ds border border-ds-border bg-ds-sky p-3 space-y-1 ds-caption tabular-nums"><p className="ds-label uppercase">Accepted terms</p>
            <p>Receiver payout: <strong>{money(open.receiver_payout_cents)}</strong></p><p>Network fee (2%): {money(open.network_fee_cents)}</p><p>Processing fee: {money(open.processing_fee_cents)}</p><p>Sender total due: <strong>{money(open.sender_total_due_cents)}</strong>{open.processing_fee_cents == null && ' + processing'}</p><p className="text-ds-on-subtle">{PROCESSING_FEE_COPY}</p></section>
          <section className="rounded-ds border border-ds-peach-border bg-ds-peach p-3 space-y-1 ds-caption"><p className="ds-label uppercase">Timeline</p>
            <p>Completed: {when(open.completed_at)}</p><p>Review ends: {when(open.review_window_ends_at)}</p><p>Payment deadline: {when(open.payment_deadline_at)}</p><p>Paid: {when(open.payment_succeeded_at)}</p><p>Tier snapshot: {open.verification_tier_snapshot ?? '—'}</p><p>Release eligible: {when(open.release_eligible_at)}</p></section>
          <section className="rounded-ds border border-ds-border bg-ds-surface p-3 space-y-1 ds-caption"><p className="ds-label uppercase">History</p>
            {open.events.length ? open.events.map((e, i) => <p key={i}>{when(e.created_at)} — {e.event_type.replace(/_/g, ' ')}{e.actor_mfn_id ? ` · ${e.actor_mfn_id}` : ''}</p>) : <p>No events yet.</p>}</section>
        </div>
        {open.side === 'sender' && !admin && effectiveSettlementState(open) === 'under_review' && <section className="rounded-ds border border-ds-border p-3 space-y-2"><p className="ds-label uppercase">Open dispute (24-hour window)</p>
          <DsField label="Category">{(fp) => <DsSelect {...fp} value={cat} onChange={e => setCat(e.target.value)}><option value="completion_missing">Completion information missing</option><option value="service_not_completed">Service not completed</option><option value="amount_incorrect">Amount incorrect</option><option value="security_issue">Safety or security issue</option></DsSelect>}</DsField>
          <DsField label="Explanation (no medical details)">{(fp) => <DsTextarea {...fp} value={why} maxLength={1000} onChange={e => setWhy(e.target.value)} />}</DsField>
          <DsButton disabled={m.isPending} onClick={() => m.mutate(open.id)}>{m.isPending ? 'Opening…' : 'Open dispute'}</DsButton></section>}
        <p className="ds-caption text-ds-on-subtle">No charge, transfer or payout happens in this version. Test mode only.</p>
      </div></div>}
  </div>;
}

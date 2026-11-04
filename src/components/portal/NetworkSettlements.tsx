import { StatusPill } from '@/components/ds/status';
import { useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { listSettlements, fileSettlementDispute, getConnectReadiness, type SettlementRow } from '@/lib/network-settlements.functions';
import { createConnectOnboardingLink } from '@/lib/payouts.functions';
import { effectiveSettlementState, SETTLEMENT_LABELS, ALERT_STATES, PROCESSING_FEE_COPY, HOLD_DAYS, connectState, CONNECT_LABELS, type SettlementState } from '@/lib/network-settlement-rules';
import { SettlementPayment } from './SettlementPayment';
import { AdminSettlementTools } from '@/components/admin/AdminSettlementTools';
import { TIER_LABELS } from '@/lib/network-settlement-rules';
import { usePortalQuery, usePortalMutation, usePortalPreview } from './preview-data';

const money = (c: number | null) => c == null ? 'Shown before payment' : `$${(c / 100).toFixed(2)}`;
const when = (s: string | null) => s ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) + ' ET' : '—';


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
  const rows = (q.data as SettlementRow[] | undefined) ?? [];
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
    {preview.active && <p role="status" className="ds-label rounded-ds-sm ds-status-blue px-3 py-2 uppercase">Preview mode — demo data. Preview only — no information was saved, sent or charged.</p>}
    <p className="ds-body rounded-ds border border-ds-border bg-ds-sky p-3 text-ds-primary">This is a settlement ledger, not a bank or escrow account. Funds stay in the platform settlement flow until the hold ends; held settlements cannot be withdrawn or accelerated. Hold: Super Verified {HOLD_DAYS.super} days, all others {HOLD_DAYS.standard} days, starting after sender payment succeeds with no open dispute. {preview.active && <strong> Preview only — demo settlements.</strong>}</p>

    {!admin && <div className="flex flex-wrap items-center justify-between gap-3 rounded-ds border border-ds-border bg-ds-surface p-4">
      <div><p className="ds-label uppercase">Stripe Connect payouts (test mode)</p><p className="ds-body">Status: <strong>{CONNECT_LABELS[cs]}</strong>. Bank and identity details are entered only on Stripe’s secure pages. Standard bank payout is the default.</p><p className="ds-caption text-ds-on-subtle">Instant Payout — coming later; its fee would be paid by the receiving provider.</p></div>
      <DsButton disabled={preview.active || cs === 'enabled'} onClick={async () => { const r = await onboard(); if (r.ok) window.location.href = r.url; else toast.error(r.error); }}>{cs === 'not_started' ? 'Start onboarding' : 'Manage on Stripe'}</DsButton>
    </div>}

    <div className="flex flex-wrap items-end gap-3">
      <DsField label="From">{(fp) => <DsInput {...fp} type="date" value={from} onChange={e => setFrom(e.target.value)} />}</DsField>
      <DsField label="To">{(fp) => <DsInput {...fp} type="date" value={to} onChange={e => setTo(e.target.value)} />}</DsField>
    </div>

    <div className="portal-finance-summary grid gap-3 grid-cols-2 lg:grid-cols-3">
      {GROUPS.map(g => { const items = withState.filter(x => g.states.includes(x.s)); const sum = items.reduce((a, x) => a + x.r.receiver_payout_cents, 0);
        return <div key={g.label} className="rounded-ds border border-ds-border bg-ds-surface p-3"><p className="ds-caption uppercase text-ds-on-subtle whitespace-nowrap">{g.label}</p><p className="ds-h4 tabular-nums"><span className="portal-money">{money(sum)}</span></p><p className="ds-caption">{items.length} settlement{items.length === 1 ? '' : 's'}</p></div>; })}
    </div>

    {q.isLoading && !preview.active ? <p className="ds-body">Loading settlements…</p> : q.isError && !preview.active ? <p className="ds-body">Settlements are unavailable right now.</p> : withState.length === 0 ? <p className="ds-body">No Network settlements yet. A settlement appears when a referral is accepted.</p> :
      <ul className="space-y-2">{withState.map(({ r, s }) => <li key={r.id}>
        <button type="button" onClick={() => setOpen(r)} className="w-full text-left rounded-ds border border-ds-border bg-ds-surface p-3 hover:bg-ds-sky">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="ds-label">{r.mfn_id} <span className="ds-caption text-ds-on-subtle">· {r.side === 'receiver' ? `from ${r.sender_workspace_mfn_id}` : `to ${r.receiver_workspace_mfn_id}`}</span></span>
            <StatusPill status={SETTLEMENT_LABELS[s]} tone={ALERT_STATES.includes(s) || s === 'under_review' ? 'red' : ['paid_out', 'transferred'].includes(s) ? 'green' : s === 'payment_due' ? 'yellow' : 'neutral'} />
            {r.payout_status === 'failed' && <StatusPill status="Payout failed — needs attention" tone="red" />}
          </div>
          <div className="mt-1 grid grid-cols-2 sm:grid-cols-4 gap-2 ds-caption tabular-nums">
            <span>Payout <strong><span className="portal-money">{money(r.receiver_payout_cents)}</span></strong></span>
            <span>Pay by <strong>{when(r.payment_deadline_at)}</strong></span>
            <span>Release {when(r.release_eligible_at)}</span>
            <span>Hold {r.hold_days ? `${r.hold_days} days` : '—'}</span>
          </div>
        </button></li>)}</ul>}

    {open && <div role="dialog" aria-modal="true" aria-label={`Settlement ${open.mfn_id}`} className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ds-on-bg/40 p-4">
      <div className="portal-custom-dialog w-full max-w-4xl rounded-ds border border-ds-border bg-ds-surface p-5 space-y-4">
        <div className="portal-dialog-header flex items-center justify-between gap-3"><h3 className="ds-h4">Settlement {open.mfn_id}</h3><DsButton variant="ghost" onClick={() => setOpen(null)}>Close</DsButton></div>
        <div className="grid gap-3 md:grid-cols-3">
          <section className="rounded-ds border border-ds-border bg-ds-sky p-3 space-y-1 ds-caption tabular-nums"><p className="ds-label uppercase">Accepted terms</p>
            <p>Receiver payout: <strong><span className="portal-money">{money(open.receiver_payout_cents)}</span></strong></p><p>Network fee (2%): <span className="portal-money">{money(open.network_fee_cents)}</span></p><p>Processing fee: <span className="portal-money">{money(open.processing_fee_cents)}</span></p><p>Sender total due: <strong><span className="portal-money">{money(open.sender_total_due_cents)}</span></strong>{open.processing_fee_cents == null && ' + processing'}</p><p className="text-ds-on-subtle">{PROCESSING_FEE_COPY}</p></section>
          <section className="rounded-ds border border-ds-peach-border bg-ds-peach p-3 space-y-1 ds-caption"><p className="ds-label uppercase">Timeline</p>
            <p>Completed: {when(open.completed_at)}</p><p>Review ends: {when(open.review_window_ends_at)}</p><p>Payment deadline: <strong>{when(open.payment_deadline_at)}</strong></p><p>Paid: {when(open.payment_succeeded_at)}</p><p>Tier snapshot: {open.verification_tier_snapshot ? TIER_LABELS[open.verification_tier_snapshot] ?? open.verification_tier_snapshot : '—'}</p><p>Hold: {open.hold_days ? `${open.hold_days} days (${open.hold_days === 4 ? 'Super Verified' : 'standard'}, from stored snapshot)` : '—'}</p><p>Release eligible: {when(open.release_eligible_at)}</p><p>Transfer: {open.transfer_status ?? '—'} · Payout: {open.payout_status === 'failed' ? <StatusPill status="Payout failed — needs attention" tone="red" /> : open.payout_status ?? '—'}</p></section>
          <section className="rounded-ds border border-ds-border bg-ds-surface p-3 space-y-1 ds-caption"><p className="ds-label uppercase">History</p>
            {open.events.length ? open.events.map((e, i) => <p key={i}>{when(e.created_at)} — {e.event_type.replace(/_/g, ' ')}{e.actor_mfn_id ? ` · ${e.actor_mfn_id}` : ''}</p>) : <p>No events yet.</p>}</section>
        </div>
        {open.side === 'sender' && !admin && ['under_review', 'payment_due', 'overdue'].includes(effectiveSettlementState(open)) && <SettlementPayment row={open} payable={!['succeeded', 'processing'].includes(open.attempt_status ?? '')} />}
        {admin && <AdminSettlementTools settlementId={open.id} releaseEligible={effectiveSettlementState(open) === 'available_for_transfer'} />}
        {open.side === 'sender' && !admin && effectiveSettlementState(open) === 'under_review' && <section className="rounded-ds border border-ds-border p-3 space-y-2"><p className="ds-label uppercase">Open dispute (24-hour window)</p>
          <DsField label="Category">{(fp) => <DsSelect {...fp} value={cat} onChange={e => setCat(e.target.value)}><option value="completion_missing">Completion information missing</option><option value="service_not_completed">Service not completed</option><option value="amount_incorrect">Amount incorrect</option><option value="security_issue">Safety or security issue</option></DsSelect>}</DsField>
          <DsField label="Explanation (no medical details)">{(fp) => <DsTextarea {...fp} value={why} maxLength={1000} onChange={e => setWhy(e.target.value)} />}</DsField>
          <DsButton disabled={m.isPending} onClick={() => m.mutate(open.id)}>{m.isPending ? 'Opening…' : 'Open dispute'}</DsButton></section>}
        <p className="ds-caption text-ds-on-subtle">Test mode only. Paid / Held starts only after Stripe confirms payment. Receivers cannot cash out early or shorten a hold.</p>
      </div></div>}
  </div>;
}

import { StatusPill } from "@/components/ds/status";
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { getAdminSettlementDetail, resolveNetworkDispute, processEligibleTestSettlement, getExclusionReasons, getAdminAttemptFees } from '@/lib/network-settlement-payments.functions';
import { usePortalPreview } from '@/components/portal/preview-data';

const money = (c: number) => `$${(c / 100).toFixed(2)}`;
const when = (s: string | null) => s ? new Date(s).toLocaleString('en-US', { timeZone: 'America/New_York' }) + ' ET' : '—';
const REASONS: Record<string, string> = { inactive: 'Inactive', suspended: 'Suspended', network_entitlement_missing: 'Network add-on missing', capability_mismatch: 'Service type mismatch', service_area_mismatch: 'Service area not verified', connect_not_ready: 'Stripe payouts not ready', already_offered: 'Already offered', declined: 'Declined', expired: 'Offer expired', source_workspace: 'Sending business', test_account: 'Test account', other: 'Other' };

/** Admin settlement detail: read-only for scoped admins; test-mode resolution and transfer for the Master Admin only. */
export function AdminSettlementTools({ settlementId, releaseEligible }: { settlementId: string; releaseEligible: boolean }) {
  const preview = usePortalPreview(); const qc = useQueryClient();
  const detail = useServerFn(getAdminSettlementDetail), resolve = useServerFn(resolveNetworkDispute), transfer = useServerFn(processEligibleTestSettlement), excl = useServerFn(getExclusionReasons);
  const q = useQuery({ queryKey: ['admin-settlement', settlementId], queryFn: () => detail({ data: { settlementId } }), enabled: !preview.active });
  const [outcome, setOutcome] = useState<'sender' | 'receiver' | 'partial'>('receiver'); const [reason, setReason] = useState(''); const [adj, setAdj] = useState('');
  const [reasons, setReasons] = useState<{ provider_mfn_id: string | null; reason_code: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const feesFn = useServerFn(getAdminAttemptFees);
  const fees = useQuery({ queryKey: ['admin-settlement-fees', settlementId], queryFn: () => feesFn({ data: { settlementId } }), enabled: !preview.active });
  if (preview.active) return <p className="ds-caption">Preview only — admin settlement tools are disabled.</p>;
  if (q.isLoading) return <p className="ds-caption">Loading admin detail…</p>;
  if (!q.data) return <p className="ds-caption">Admin detail unavailable.</p>;
  const d = q.data; const open = d.disputes.find(x => x.status === 'open');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin-settlement', settlementId] }); qc.invalidateQueries({ queryKey: ['network-settlements'] }); };
  return <div className="space-y-3">
    {fees.data && <FeePanel f={fees.data} />}
    <div className="grid gap-3 md:grid-cols-3">
      <section className="rounded-ds border border-ds-border bg-ds-surface p-3 ds-caption space-y-1"><p className="ds-label uppercase">Payment attempts</p>
        {d.attempts.length ? d.attempts.map(a => <p key={a.mfn_id}>{a.mfn_id} · {a.method} · <span className="portal-money">{money(a.total_cents)}</span> · v{a.policy_version} · <StatusPill status={a.status} />{a.error_code ? ` (${a.error_code})` : ''}</p>) : <p>None yet.</p>}</section>
      <section className="rounded-ds border border-ds-border bg-ds-sky p-3 ds-caption space-y-1"><p className="ds-label uppercase">Transfer & payout</p>
        <p>Receiver Connect ready: {d.receiver_connect_ready ? 'Yes' : 'No'}</p><p>Transfer: {d.transfer ? <>{d.transfer.status} · <span className="portal-money">{money(d.transfer.amount_cents)}</span></> : 'Not started'}</p><p>Payout: {d.payout_status === 'failed' ? <StatusPill status="Payout failed — needs attention" tone="red" /> : d.payout_status ?? '—'}</p><p>Refunded: {when(d.refunded_at)}</p><p>Chargeback: {d.chargeback_status ?? '—'}</p></section>
      <section className="rounded-ds border border-ds-border bg-ds-surface p-3 ds-caption space-y-1"><p className="ds-label uppercase">Disputes & adjustments</p>
        {d.disputes.map(x => <p key={x.id}><span>{x.category.replace(/_/g, ' ')} · </span><StatusPill status={x.status === 'open' ? 'Disputed — open' : x.status} />{x.resolution ? ` → ${x.resolution} (${x.resolved_by ?? ''})` : ''}{x.explanation ? ` — ${x.explanation}` : ''}{x.evidence_count ? ` · ${x.evidence_count} evidence item(s), private` : ''}</p>)}
        {d.adjustments.map(j => <p key={j.version}>Adjustment v{j.version}: <span className="portal-money">{money(j.delta_receiver_cents)}</span> — {j.reason}</p>)}
        {!d.disputes.length && !d.adjustments.length && <p>None.</p>}</section>
    </div>
    {d.is_master && <div className="rounded-ds border border-ds-peach-border bg-ds-peach p-3 space-y-3"><p className="ds-label uppercase">Master Admin — test mode only</p>
      <p className="ds-body">Refund, reversal, dispute-resolution and transfer actions are off. Review evidence only.</p>
      <div className="flex flex-wrap items-center gap-2">
        {d.distribution_id && <DsButton variant="ghost" disabled={busy} onClick={async () => { try { setReasons(await excl({ data: { distributionId: d.distribution_id ?? '' } })); } catch (e) { toast.error((e as Error).message); } }}>Show excluded providers</DsButton>}
      </div>
      <p className="ds-caption text-ds-on-subtle">No “release now” option exists; the hold cannot be bypassed.</p>
      {reasons && <ul className="ds-caption grid sm:grid-cols-2 gap-1">{reasons.length ? reasons.map((r, i) => <li key={i}>{r.provider_mfn_id ?? 'Provider'} — {REASONS[r.reason_code] ?? r.reason_code}</li>) : <li>No exclusions recorded.</li>}</ul>}
    </div>}
  </div>;
}

function FeePanel({ f }: { f: import('@/lib/network-settlement-payments.functions').AdminAttemptFees }) {
  const rule = (a: (typeof f.attempts)[number]) => a.percent_bps == null ? 'Not recorded (earlier attempt)' : `${(a.percent_bps / 100).toFixed(2)}% + ${money(a.fixed_cents ?? 0)}${a.cap_cents != null ? `, cap ${money(a.cap_cents)}` : ''}`;
  return <div className="grid gap-3 md:grid-cols-3">
    <section className="md:col-span-2 rounded-ds border border-ds-border bg-ds-surface p-3 ds-caption space-y-2"><p className="ds-label uppercase">Fee recovery (read-only)</p>
      {f.attempts.length ? f.attempts.map(a => <div key={a.mfn_id} className="grid gap-x-4 sm:grid-cols-2">
        <p className="sm:col-span-2"><strong>{a.mfn_id}</strong> · {a.method} · policy v{a.policy_version} · {a.sandbox_estimate === false ? 'Approved rate' : 'Sandbox estimate — not an approved live rate'} · {a.status}</p>
        <p>Receiver payout: <span className="portal-money">{money(a.receiver_payout_cents)}</span></p><p>2% Network fee: <span className="portal-money">{money(a.network_fee_cents)}</span></p>
        <p>Subtotal: <span className="portal-money">{money(a.subtotal_cents)}</span></p><p>Processing recovery: <span className="portal-money">{money(a.processing_fee_cents)}</span> ({rule(a)})</p>
        <p><strong>Total: <span className="portal-money">{money(a.total_cents)}</span></strong></p>
        <p>Reported processor fee: {a.reported_processor_fee_cents == null ? 'Not Available' : <span className="portal-money">{money(a.reported_processor_fee_cents)}</span>}{a.variance_cents != null ? ` · variance ${money(a.variance_cents)} (reconciliation only)` : ''}</p>
      </div>) : <p>No payment attempts yet.</p>}</section>
    <section className="rounded-ds border border-ds-border bg-ds-sky p-3 ds-caption space-y-1"><p className="ds-label uppercase">Webhook readiness (sandbox)</p>
      <p>Main webhook last event: {when(f.platform_webhook_last)}</p>
      <p>Connected-account webhook: {f.connect_secret_configured ? 'Signing secret configured' : 'Not configured'}</p>
      <p>Connected-account last event: {when(f.connect_webhook_last)}</p></section>
  </div>;
}

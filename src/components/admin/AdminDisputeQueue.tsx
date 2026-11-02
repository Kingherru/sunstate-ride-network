import { StatusPill } from "@/components/ds/status";
import { useServerFn } from '@tanstack/react-start';
import { listAdminDisputes, type DisputeRow } from '@/lib/network-settlements.functions';
import { usePortalQuery } from '@/components/portal/preview-data';

/** Read-only dispute queue foundation; financial resolution tools arrive in Pass 3O-B. */
export function AdminDisputeQueue() {
  const list = useServerFn(listAdminDisputes);
  const q = usePortalQuery({ queryKey: ['admin-network-disputes'], queryFn: () => list() });
  const rows = (q.data as DisputeRow[] | undefined) ?? [];
  return <div className="mt-6 rounded-ds border border-ds-border bg-ds-surface p-4">
    <p className="ds-label uppercase mb-2">Dispute queue (read-only)</p>
    {q.isError ? <p className="ds-body">Dispute queue unavailable.</p> : rows.length === 0 ? <p className="ds-body">No open Network disputes.</p> :
      <ul className="space-y-1 ds-caption">{rows.map(d => <li key={d.id} className="flex flex-wrap justify-between gap-2 border-b border-ds-border py-1"><span>{d.settlement_mfn_id} · {d.sender} → {d.receiver}</span><span>{d.category.replace(/_/g, ' ')} · <StatusPill status={d.status === 'open' ? 'Disputed — open' : d.status} /> · {new Date(d.created_at).toLocaleDateString('en-US', { timeZone: 'America/New_York' })}</span></li>)}</ul>}
    <p className="ds-caption text-ds-on-subtle mt-2">No release, charge, refund or transfer actions are available in this version.</p>
  </div>;
}

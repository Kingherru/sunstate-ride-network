import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsSelect, DsTextarea } from '@/components/ds/controls';
import { listNetworkPayments, recordNetworkCompletion, openNetworkPaymentDispute, resolveNetworkPaymentDispute, type NetworkPaymentRow } from '@/lib/network-payments.functions';
import { NETWORK_PAYMENT_LABELS } from '@/lib/network-payment-rules';
import { usePortalQuery, usePortalMutation } from './preview-data';

const date = (s: string | null) => s ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(s)) + ' ET' : '—';
export function NetworkPayments() {
  const list = useServerFn(listNetworkPayments), complete = useServerFn(recordNetworkCompletion), dispute = useServerFn(openNetworkPaymentDispute), resolve = useServerFn(resolveNetworkPaymentDispute);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['network-payments'], queryFn: () => list() });
  const [selected, setSelected] = useState<{ row: NetworkPaymentRow; action: 'complete' | 'dispute' | 'resolve' } | null>(null);
  const [reason, setReason] = useState('completion_missing'), [resolution, setResolution] = useState('');
  const m = usePortalMutation({ mutationFn: async () => {
    if (!selected) return;
    const distributionId = selected.row.id;
    if (selected.action === 'complete') await complete({ data: { distributionId, confirmed: true } });
    else if (selected.action === 'dispute') await dispute({ data: { distributionId, reason: reason as 'completion_missing', confirmed: true } });
    else await resolve({ data: { distributionId, reason: resolution, confirmed: true } });
  }, onSuccess: async () => { setSelected(null); setResolution(''); toast.success('Network status recorded.'); await qc.invalidateQueries({ queryKey: ['network-payments'] }); await qc.invalidateQueries({ queryKey: ['network-activity'] }); }, onError: (e: Error) => toast.error(e.message) });
  return <div className="space-y-4">
    <h2 className="ds-subheading text-ds-primary uppercase">Network payments</h2>
    <p className="ds-support">Payment is due within three business days after completed service and required completion information are recorded. Times use New York time; Stripe processing is separate.</p>
    {q.isLoading && <p className="ds-body">Loading payments…</p>}
    {q.error && <p role="alert" className="ds-body text-ds-error">Could not load Network payments.</p>}
    {!q.isLoading && !q.error && !q.data?.length && <p className="ds-body text-ds-muted">No accepted provider-to-provider Network trips.</p>}
    {(q.data ?? []).map(row => <article key={row.id} className="space-y-3 border-b border-ds-border py-4">
      <div className="flex flex-wrap justify-between gap-2"><h3 className="ds-label font-mono">{row.mfn_id}</h3><strong className={`ds-label ${row.state === 'overdue' || row.state === 'disputed' ? 'text-ds-error' : 'text-ds-primary'}`}>{NETWORK_PAYMENT_LABELS[row.state]}</strong></div>
      <dl className="grid gap-3 sm:grid-cols-3 ds-support"><div><dt>Completion recorded</dt><dd>{date(row.completed_at)}</dd></div><div><dt>Payment due</dt><dd>{date(row.due_at)}</dd></div><div><dt>Payment initiated</dt><dd>{date(row.initiated_at)}</dd></div><div><dt>Paid</dt><dd>{date(row.paid_at)}</dd></div><div><dt>Dispute opened</dt><dd>{date(row.dispute_opened_at)}</dd></div><div><dt>Dispute resolved</dt><dd>{date(row.dispute_resolved_at)}</dd></div></dl>
      <div className="flex flex-wrap gap-2">
        {row.can_complete && !row.completed_at && <DsButton size="sm" variant="secondary" onClick={() => setSelected({ row, action: 'complete' })}>Confirm completion information</DsButton>}
        {row.can_dispute && row.completed_at && !row.dispute_opened_at && Date.now() <= Date.parse(row.completed_at) + 86400000 && !['paid','refunded'].includes(row.state) && <DsButton size="sm" variant="secondary" onClick={() => setSelected({ row, action: 'dispute' })}>Open payment dispute</DsButton>}
        {row.can_resolve && row.dispute_opened_at && !row.dispute_resolved_at && <DsButton size="sm" variant="secondary" onClick={() => setSelected({ row, action: 'resolve' })}>Resolve dispute</DsButton>}
      </div>
    </article>)}
    {selected && <div role="dialog" aria-modal="true" aria-label="Confirm Network payment action" className="fixed inset-0 z-50 flex items-center justify-center bg-ds-primary/50 p-4"><form className="w-full max-w-lg space-y-4 rounded-ds bg-ds-surface p-6" onSubmit={e => { e.preventDefault(); m.mutate(); }}>
      <h3 className="ds-subheading text-ds-primary">{selected.action === 'complete' ? 'Confirm completion information' : selected.action === 'dispute' ? 'Confirm payment dispute' : 'Confirm dispute resolution'}</h3>
      <p className="ds-body font-mono">{selected.row.mfn_id}</p>
      {selected.action === 'complete' && <p className="ds-body">Confirm the assigned trip is Completed and all required completion information has been submitted. This starts the payment window.</p>}
      {selected.action === 'dispute' && <DsField label="Reason">{p => <DsSelect {...p} value={reason} onChange={e => setReason(e.target.value)}><option value="completion_missing">Missing completion information</option><option value="service_not_completed">Service not completed</option><option value="amount_incorrect">Incorrect amount</option><option value="security_issue">Security issue</option></DsSelect>}</DsField>}
      {selected.action === 'resolve' && <DsField label="Documented resolution" hint="Do not include card, bank, passenger or medical details.">{p => <DsTextarea {...p} required minLength={10} maxLength={500} value={resolution} onChange={e => setResolution(e.target.value)} />}</DsField>}
      <div className="flex justify-end gap-2"><DsButton type="button" variant="ghost" onClick={() => setSelected(null)} disabled={m.isPending}>Cancel</DsButton><DsButton type="submit" disabled={m.isPending}>Confirm</DsButton></div>
    </form></div>}
  </div>;
}
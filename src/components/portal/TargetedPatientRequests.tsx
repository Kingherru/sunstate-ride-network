import { useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { DsButton } from '@/components/ds/controls';
import { listTargetedPatientRequests, respondTargetedPatientRequest } from '@/lib/patient-provider.functions';
import { usePortalQuery, usePortalPreview, previewBlocked } from './preview-data';
import { useRequestDetails } from './request-detail-context';

export function TargetedPatientRequests() {
  const list = useServerFn(listTargetedPatientRequests); const respond = useServerFn(respondTargetedPatientRequest);
  const preview = usePortalPreview(); const qc = useQueryClient(); const details = useRequestDetails();
  const q = usePortalQuery({ queryKey: ['targeted-patient-requests'], queryFn: () => list() });
  async function decide(id: string, accept: boolean) {
    if (preview.active) { previewBlocked(); return; }
    if (!window.confirm(accept ? 'Accept this targeted patient request for follow-up? This does not confirm a booking or charge a payment.' : 'Decline this targeted patient request?')) return;
    try { await respond({ data: { id, accept } }); await qc.invalidateQueries({ queryKey: ['targeted-patient-requests'] }); toast.success(accept ? 'Accepted for follow-up. Booking remains unconfirmed.' : 'Request declined.'); }
    catch { toast.error('Could not update this request.'); }
  }
  return <section className="space-y-3"><h2 className="ds-subheading uppercase text-ds-primary">Patient requests sent to you</h2>
    {q.isLoading && <p role="status" className="ds-support">Loading…</p>}{q.isError && <p role="alert" className="ds-support text-ds-error">Requests unavailable.</p>}
    {(q.data ?? []).length === 0 && !q.isLoading && <p className="ds-support">No targeted patient requests.</p>}
    {(q.data ?? []).map(r => <article key={r.id} className="border border-ds-sky-border bg-ds-sky rounded-ds p-4"><h3 className="ds-label">{r.mfn_id}</h3><p className="ds-body">{r.pickup_area} → {r.destination_area} · {r.pickup_date} {r.pickup_time} · {r.transport_type}</p><p className="ds-caption">{r.selection_status === 'accepted' ? 'Accepted for follow-up · booking unconfirmed' : r.selection_status}</p><div className="flex gap-2 mt-3">{r.selection_status === 'pending' && <><DsButton size="sm" onClick={() => decide(r.id, true)}>Accept for follow-up</DsButton><DsButton size="sm" variant="ghost" onClick={() => decide(r.id, false)}>Decline</DsButton></>}{r.selection_status === 'accepted' && <DsButton size="sm" variant="secondary" onClick={() => details({ kind: 'request', id: r.id })}>View request</DsButton>}</div></article>)}
  </section>;
}
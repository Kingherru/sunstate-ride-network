import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsTextarea } from '@/components/ds/controls';
import { adminRequestAction } from '@/lib/request-lifecycle.functions';
import { useAdminLevel } from '@/lib/use-admin-level';
import type { RequestDetailRow } from '@/lib/portal-requests.functions';
import { DetailSection } from './DetailSection';

const EDITABLE: { key: string; label: string; area?: boolean; delivery?: boolean; passenger?: boolean }[] = [
  { key: 'pickup_address', label: 'Pickup location' }, { key: 'pickup_address_details', label: 'Pickup location details' },
  { key: 'pickup_city', label: 'Pickup city' }, { key: 'pickup_zip', label: 'Pickup ZIP' },
  { key: 'dropoff_address', label: 'Drop-off / destination' }, { key: 'dropoff_city', label: 'Destination city' }, { key: 'dropoff_zip', label: 'Destination ZIP' },
  { key: 'pickup_date', label: 'Pickup date (YYYY-MM-DD)' }, { key: 'pickup_time', label: 'Pickup time (HH:MM)' },
  { key: 'appointment_time', label: 'Appointment time (HH:MM)', passenger: true },
  { key: 'patient_phone', label: 'Contact phone' }, { key: 'patient_email', label: 'Contact email' },
  { key: 'mobility_notes', label: 'Mobility notes', passenger: true, area: true },
  { key: 'special_instructions', label: 'Additional information', passenger: true, area: true },
  { key: 'delivery_instructions', label: 'Handling instructions', delivery: true, area: true },
];
type Mode = null | 'edit' | 'deny' | 'deactivate';
const str = (v: unknown) => (v == null ? '' : String(v));

/** Admin-only overlay actions. Every mutation is confirmed, server-authorized and recorded in append-only history. */
export function AdminRequestActions({ r, delivery }: { r: RequestDetailRow; delivery: boolean }) {
  const level = useAdminLevel('requests');
  const qc = useQueryClient();
  const act = useServerFn(adminRequestAction);
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const fields = EDITABLE.filter((f) => (delivery ? !f.passenger : !f.delivery));
  const state = str(r.lifecycle_state) || 'submitted';
  const inactive = !!r.deactivated_at;
  const canDeny = ['in_review'].includes(state);
  if (level !== 'manage') return <DetailSection title="Admin actions"><p className="ds-support">Read-only access: actions are not available.</p></DetailSection>;

  function start(m: Mode) {
    setMode(m); setReason(''); setConfirming(false);
    if (m === 'edit') setForm(Object.fromEntries(fields.map((f) => [f.key, str(r[f.key])])));
  }
  async function submit() {
    if (!mode) return;
    setBusy(true);
    const patch = mode === 'edit' ? Object.fromEntries(fields.filter((f) => form[f.key] !== str(r[f.key])).map((f) => [f.key, form[f.key]])) : undefined;
    if (mode === 'edit' && !Object.keys(patch!).length) { setBusy(false); toast.error('No changes to save.'); return; }
    const res = await act({ data: { id: String(r.id), action: mode, reason: reason || undefined, patch: patch as never } });
    setBusy(false);
    if (!res.ok) { toast.error(res.error); return; }
    toast.success(mode === 'edit' ? 'Changes saved and recorded.' : mode === 'deny' ? 'Request denied and recorded.' : 'Request deactivated; history preserved.');
    setMode(null);
    await Promise.all([qc.invalidateQueries({ queryKey: ['request-overlay'] }), qc.invalidateQueries({ queryKey: ['request-lifecycle', String(r.id)] })]);
  }
  const needsReason = mode === 'deny' || mode === 'deactivate';
  return (
    <DetailSection title="Admin actions">
      {inactive ? <p className="ds-body">This request is deactivated. Its history is preserved and no further actions are available.</p> : <>
        <div className="flex flex-wrap gap-2 border-b border-ds-sky-border pb-3">
          <DsButton size="sm" variant="secondary" onClick={() => start('edit')}>Edit</DsButton>
          <DsButton size="sm" variant="secondary" disabled={!canDeny} onClick={() => start('deny')}>Deny</DsButton>
          <DsButton size="sm" variant="secondary" disabled title="Notification resend is not connected yet">Resend</DsButton>
          <DsButton size="sm" variant="secondary" disabled title="Distribution connection pending">Forward / Redistribute</DsButton>
          <DsButton size="sm" variant="ghost" onClick={() => start('deactivate')}>Deactivate</DsButton>
        </div>
        <ul className="ds-support mt-2 space-y-1">
          {!canDeny && <li>Deny is available once the request is In Review.</li>}
          <li>Resend: request notifications are not connected to a resend workflow yet, so nothing can be resent.</li>
          <li>Forward / Redistribute: distribution connection pending. Nothing is sent and no status changes until the provider-offer workflow is approved.</li>
        </ul>
      </>}
      {mode && (
        <div className="mt-4 rounded-ds border border-ds-border bg-ds-surface p-4">
          <h3 className="ds-label uppercase text-ds-primary">{mode === 'edit' ? 'Edit request' : mode === 'deny' ? 'Deny request' : 'Deactivate request'}</h3>
          {mode === 'edit' && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{fields.map((f) => <DsField key={f.key} label={f.label}>{(p) => f.area ? <DsTextarea {...p} maxLength={500} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} /> : <DsInput {...p} maxLength={200} value={form[f.key] ?? ''} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />}</DsField>)}</div>}
          <div className="mt-3"><DsField label={needsReason ? 'Reason (required)' : 'Reason for change (optional)'}>{(p) => <DsTextarea {...p} maxLength={500} placeholder="No medical details" value={reason} onChange={(e) => setReason(e.target.value)} />}</DsField></div>
          {mode === 'deactivate' && <p className="ds-support mt-2">Deactivation is a soft removal. The request, trips, payments, messages and history are never deleted.</p>}
          {!confirming
            ? <div className="mt-3 flex gap-2"><DsButton size="sm" disabled={needsReason && reason.trim().length < 3} onClick={() => setConfirming(true)}>{mode === 'edit' ? 'Save' : 'Continue'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</DsButton></div>
            : <div role="alertdialog" aria-label="Confirm action" className="mt-3 rounded-ds border border-ds-sky-border bg-ds-sky p-3"><p>Confirm this action? It is recorded with your MFN ID and the time.</p><div className="mt-2 flex gap-2"><DsButton size="sm" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setConfirming(false)}>Back</DsButton></div></div>}
        </div>
      )}
    </DetailSection>
  );
}

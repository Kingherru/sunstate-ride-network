import { useMemo, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsCheckbox, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { createSavedPatient, getPatientScope, listSavedPatientHistory, listSavedPatients, setSavedPatientActive, updateSavedPatient } from '@/lib/saved-patients.functions';
import { listMyPayers } from '@/lib/payers.functions';
import { listSavedPaymentMethods, setPaymentMethodPatient } from '@/lib/saved-payments.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';
import {LinkedPatientSelector} from './LinkedPatientSelector';
import {PreferredDriver} from './PreferredDriver';

type F = { key: string; label: string; type?: 'text' | 'date' | 'email' | 'tel' | 'number' | 'textarea'; max?: number };
const GROUPS: { title: string; fields: F[] }[] = [
  { title: 'Identity & contact', fields: [{ key: 'first_name', label: 'First name' }, { key: 'last_name', label: 'Last name' }, { key: 'dob', label: 'Date of birth', type: 'date' }, { key: 'gender', label: 'Gender', max: 20 }, { key: 'phone', label: 'Phone', type: 'tel' }, { key: 'email', label: 'Email', type: 'email' }] },
  { title: 'Home address', fields: [{ key: 'address_line1', label: 'Address line 1' }, { key: 'address_line2', label: 'Address line 2' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State', max: 2 }, { key: 'zip', label: 'ZIP', max: 10 }] },
  { title: 'Default trip locations', fields: [{ key: 'default_pickup_address', label: 'Default pickup address' }, { key: 'default_pickup_city', label: 'Pickup city' }, { key: 'default_dropoff_address', label: 'Default drop-off address' }, { key: 'default_dropoff_city', label: 'Drop-off city' }] },
  { title: 'Accessibility & service needs', fields: [{ key: 'mobility', label: 'Mobility level' }, { key: 'mobility_device', label: 'Mobility device' }, { key: 'wheelchair_type', label: 'Wheelchair type' }, { key: 'weight_lbs', label: 'Weight (lbs)', type: 'number' }, { key: 'assistance_needs', label: 'Assistance needs', type: 'textarea' }, { key: 'communication_needs', label: 'Communication needs', type: 'textarea' }, { key: 'service_requirements', label: 'Service requirements', type: 'textarea' }] },
  { title: 'Coverage & authorization', fields: [{ key: 'payer', label: 'Payer name' }, { key: 'medicaid_id', label: 'Medicaid ID' }, { key: 'medicaid_number', label: 'Medicaid number' }, { key: 'medicaid_plan', label: 'Medicaid plan' }, { key: 'authorization_number', label: 'Authorization number' }, { key: 'diagnosis_code', label: 'Diagnosis code' }] },
  { title: 'Notes', fields: [{ key: 'notes', label: 'Notes', type: 'textarea', max: 2000 }] },
];
const KEYS = GROUPS.flatMap(g => g.fields.map(f => f.key));

function toPayload(form: Record<string, any>) {
  const out: Record<string, unknown> = {};
  for (const k of KEYS) out[k] = k === 'weight_lbs' ? (form[k] ? Number(form[k]) : null) : (form[k] ?? '');
  out.oxygen_required = !!form.oxygen_required;
  out.default_payer_id = form.default_payer_id || null;
  out.patient_workspace_id=form.patient_workspace_id||null;
  if(form.preferred_driver_id!==undefined)out.preferred_driver_id=form.preferred_driver_id||null;
  return out;
}

export function PatientManagement() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const list = useServerFn(listSavedPatients);
  const scopeFn = useServerFn(getPatientScope);
  const payersFn = useServerFn(listMyPayers);
  const create = useServerFn(createSavedPatient);
  const update = useServerFn(updateSavedPatient);
  const setActive = useServerFn(setSavedPatientActive);
  const historyFn = useServerFn(listSavedPatientHistory);
  const q = usePortalQuery({ queryKey: ['saved-patients'], queryFn: () => list() });
  const scope = usePortalQuery({ queryKey: ['patient-scope'], queryFn: () => scopeFn() });
  const payers = usePortalQuery({ queryKey: ['my-payers'], queryFn: () => payersFn() });
  const cardsFn = useServerFn(listSavedPaymentMethods);
  const linkCard = useServerFn(setPaymentMethodPatient);
  const cards = usePortalQuery({ queryKey: ['payer-cards'], queryFn: () => cardsFn() });
  const cardRows = ((cards.data as any[]) ?? []);
  async function changeCard(patientId: string, cardId: string) {
    if (preview.active) return previewBlocked();
    const current = cardRows.find(c => c.patient_id === patientId);
    try {
      if (current && current.id !== cardId) { const r = await linkCard({ data: { id: current.id, patient_id: null } }); if ('error' in r) throw new Error(r.error); }
      if (cardId) { const r = await linkCard({ data: { id: cardId, patient_id: patientId } }); if ('error' in r) throw new Error(r.error); }
      toast.success(cardId ? 'Card linked to patient.' : 'Card link removed. The card stays saved.');
      await qc.invalidateQueries({ queryKey: ['payer-cards'] });
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not update.'); }
  }
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusFor, setStatusFor] = useState<{ id: string; active: boolean } | null>(null);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState<{ id: string; rows: any[] } | null>(null);

  const sc = scope.data as { ids: string[]; privateOnly: boolean } | undefined;
  const privateOnly = !!sc?.privateOnly;
  const all = ((q.data as any[]) ?? []).filter(p => (p.kind ?? 'patient') === 'patient');
  const rows = useMemo(() => all.filter(p => (showInactive || p.active !== false) && `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.trim().toLowerCase())), [all, search, showInactive]);
  const payerRows = ((payers.data as any[]) ?? []).filter(x => x.active !== false);
  const canAdd = !privateOnly || !all.some(p => p.active !== false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['saved-patients'] });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active) return previewBlocked();
    if (!editing) return;
    setBusy(true);
    try {
      const payload = toPayload(editing) as any;
      if (editing.id) await update({ data: { id: editing.id, ...payload } });
      else await create({ data: { ...payload, kind: 'patient' } });
      toast.success('Patient profile saved.'); setEditing(null); await invalidate();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not save.'); } finally { setBusy(false); }
  }
  async function changeStatus() {
    if (preview.active) return previewBlocked();
    if (!statusFor) return;
    setBusy(true);
    try { await setActive({ data: { id: statusFor.id, active: statusFor.active, reason } }); toast.success(statusFor.active ? 'Patient restored.' : 'Patient deactivated.'); setStatusFor(null); setReason(''); await invalidate(); }
    catch (err) { toast.error(err instanceof Error ? err.message : 'Change unavailable.'); } finally { setBusy(false); }
  }
  async function openHistory(id: string) {
    if (preview.active) return setHistory({ id, rows: [] });
    try { setHistory({ id, rows: await historyFn({ data: { id } }) }); } catch { toast.error('History unavailable.'); }
  }

  if (editing) return (
    <form onSubmit={submit} className="space-y-5" aria-label="Patient profile">
      <h2 className="ds-subheading uppercase text-ds-primary">{editing.id ? 'Edit patient' : 'Add patient'}</h2>
      {!privateOnly && <LinkedPatientSelector value={editing.patient_workspace_id} onChange={id=>setEditing({...editing,patient_workspace_id:id})}/>}
      {!privateOnly&&editing.workspace_id&&<PreferredDriver workspaceId={editing.workspace_id} value={editing.preferred_driver_id??null} onChange={id=>setEditing({...editing,preferred_driver_id:id})}/>}
      {GROUPS.map(g => <fieldset key={g.title} className="rounded-ds bg-ds-surface-muted p-4 sm:p-5"><legend className="ds-label text-ds-primary px-1">{g.title}</legend>
        <div className="grid gap-4 sm:grid-cols-2">{g.fields.map(f => <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}><DsField label={f.label}>{p => f.type === 'textarea'
          ? <DsTextarea {...p} maxLength={f.max ?? 500} value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />
          : <DsInput {...p} type={f.type ?? 'text'} autoComplete="off" required={f.key === 'first_name' || f.key === 'last_name'} maxLength={f.max ?? 255} value={editing[f.key] ?? ''} onChange={e => setEditing({ ...editing, [f.key]: e.target.value })} />}</DsField></div>)}
          {g.title.startsWith('Accessibility') && <DsCheckbox label="Oxygen required" checked={!!editing.oxygen_required} onChange={e => setEditing({ ...editing, oxygen_required: e.target.checked })} />}
          {g.title.startsWith('Coverage') && <DsField label="Default payer">{p => <DsSelect {...p} value={editing.default_payer_id ?? ''} onChange={e => setEditing({ ...editing, default_payer_id: e.target.value })}><option value="">No default payer</option>{payerRows.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</DsSelect>}</DsField>}
        </div></fieldset>)}
      <div className="flex gap-2"><DsButton type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save patient'}</DsButton><DsButton type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</DsButton></div>
    </form>
  );

  return (
    <section className="space-y-4" aria-labelledby="pm-h">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pm-h" className="ds-subheading uppercase text-ds-primary">{privateOnly ? 'My patient profile' : 'Patients'}</h2>
        {canAdd && <DsButton size="sm" onClick={() => setEditing({})}>Add patient</DsButton>}
      </div>
      {!privateOnly && <div className="flex flex-wrap items-end gap-4"><div className="min-w-[14rem] flex-1"><DsField label="Search patients">{p => <DsInput {...p} type="search" autoComplete="off" value={search} onChange={e => setSearch(e.target.value)} />}</DsField></div><DsCheckbox label="Show deactivated" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /></div>}
      {q.isLoading ? <p role="status" className="ds-support">Loading…</p> : q.isError ? <p role="alert" className="ds-support">Patient profiles are unavailable.</p> : rows.length === 0 ? <p className="ds-support rounded-ds bg-ds-surface-muted p-4">No patient profiles yet.</p> : (
        <ul className="divide-y divide-ds-border rounded-ds border border-ds-border bg-ds-surface">{rows.map(p => <li key={p.id} className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="ds-body font-semibold">{p.first_name} {p.last_name}{p.active === false && <span className="ds-support"> · Deactivated</span>}</p><p className="ds-caption font-mono">{p.mfn_id ?? ''}</p></div>
            <div className="flex flex-wrap gap-2">
              {p.active !== false && <DsButton size="sm" variant="secondary" onClick={() => setEditing({ ...p })}>Open / edit</DsButton>}
              {!privateOnly && <DsButton size="sm" variant="ghost" onClick={() => { setStatusFor({ id: p.id, active: p.active === false }); setReason(''); }}>{p.active === false ? 'Restore' : 'Deactivate'}</DsButton>}
              <DsButton size="sm" variant="ghost" onClick={() => openHistory(p.id)}>History</DsButton>
            </div>
          </div>
          {!privateOnly && p.active !== false && cardRows.length > 0 && <div className="max-w-sm"><DsField label="Payment card for this patient" hint="Changes unavailable until secure re-verification is activated.">{f => <DsSelect {...f} disabled value={cardRows.find(c => c.patient_id === p.id)?.id ?? ''}><option value="">No patient card (use account default)</option>{cardRows.filter(c => !c.patient_id || c.patient_id === p.id).map(c => <option key={c.id} value={c.id}>{String(c.brand ?? 'Card').toUpperCase()} •••• {c.last4} · exp {String(c.exp_month).padStart(2, '0')}/{String(c.exp_year).slice(-2)}</option>)}</DsSelect>}</DsField></div>}
          {statusFor?.id === p.id && <div role="alertdialog" aria-label="Confirm status change" className="space-y-3 rounded-ds bg-ds-surface-muted p-4">
            <DsField label={`Reason to ${statusFor!.active ? 'restore' : 'deactivate'}`}>{f => <DsTextarea {...f} minLength={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} />}</DsField>
            <div className="flex gap-2"><DsButton size="sm" disabled={busy || reason.trim().length < 3} onClick={changeStatus}>Confirm {statusFor!.active ? 'restore' : 'deactivation'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setStatusFor(null)}>Cancel</DsButton></div>
          </div>}
          {history?.id === p.id && <div className="rounded-ds bg-ds-surface-muted p-4"><div className="flex justify-between"><h3 className="ds-label text-ds-primary">Audit history</h3><button className="ds-support underline" onClick={() => setHistory(null)}>Close</button></div>
            {history!.rows.length ? <ul className="ds-support mt-2 space-y-1">{history!.rows.map(h => <li key={h.id}>{new Date(h.created_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} · {h.action} · {h.actor_mfn_id ?? '—'}{h.reason ? ` · ${h.reason}` : ''}</li>)}</ul> : <p className="ds-support mt-2">No history recorded.</p>}</div>}
        </li>)}</ul>
      )}
    </section>
  );
}

import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getOnboarding, saveOnboardingSection } from '@/lib/onboarding.functions';
import { DsButton, DsField, DsInput, DsSelect } from '@/components/ds/controls';
import { usePortalPreview, usePortalQuery } from './preview-data';

/** Uses the existing single-patient owner model, never creates inferred links. */
export function PatientRelationship() {
  const preview = usePortalPreview();
  const get = useServerFn(getOnboarding);
  const save = useServerFn(saveOnboardingSection);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['patient-owner-profile'], queryFn: () => get() });
  const [relationship, setRelationship] = useState('');
  const [first, setFirst] = useState(''); const [last, setLast] = useState('');
  const [mobility, setMobility] = useState<'ambulatory' | 'wheelchair' | 'stretcher'>('ambulatory');
  const [busy, setBusy] = useState(false);
  function chooseRelationship(next: string) {
    setRelationship(next);
    if (next === 'Self' && q.data) { setFirst(q.data.person.first_name ?? ''); setLast(q.data.person.last_name ?? ''); }
  }
  useEffect(() => {
    if (!q.data) return;
    setRelationship(q.data.legacy?.patient_type === 'self' ? 'Self' : q.data.legacy?.patient_relationship ?? '');
    setFirst(q.data.patient?.first_name ?? ''); setLast(q.data.patient?.last_name ?? '');
    const m = q.data.patient?.mobility; if (m === 'ambulatory' || m === 'wheelchair' || m === 'stretcher') setMobility(m);
  }, [q.data]);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (preview.active || !relationship) return;
    setBusy(true);
    try { await save({ data: { section: 'patient', accountFor: relationship === 'Self' ? 'myself' : 'another', first_name: first, last_name: last, relationship: relationship === 'Self' ? '' : relationship, mobility } }); await qc.invalidateQueries({ queryKey: ['patient-owner-profile'] }); await qc.invalidateQueries({ queryKey: ['saved-patients'] }); await qc.invalidateQueries({ queryKey: ['account-profile-verification'] }); toast.success('Patient information saved.'); }
    catch { toast.error('Could not save patient information. Manage multiple existing patients in Patients.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="portal-business-section"><h2 className="portal-business-heading ds-subheading uppercase">Transported patient</h2><div className="portal-business-body grid gap-4 sm:grid-cols-2"><DsField label="Account owner’s relationship to patient">{p => <DsSelect {...p} required disabled={!q.data || preview.active} value={relationship} onChange={e => chooseRelationship(e.target.value)}><option value="">Choose relationship</option>{['Self','Sibling','Parent','Grandparent','Other'].map(r => <option key={r}>{r}</option>)}{relationship && !['Self','Sibling','Parent','Grandparent','Other'].includes(relationship) && <option>{relationship}</option>}</DsSelect>}</DsField><div/><DsField label="Patient first name">{p => <DsInput {...p} required maxLength={80} value={first} onChange={e => setFirst(e.target.value)} />}</DsField><DsField label="Patient last name">{p => <DsInput {...p} required maxLength={80} value={last} onChange={e => setLast(e.target.value)} />}</DsField><DsField label="Transportation need">{p => <DsSelect {...p} value={mobility} onChange={e => { const m = e.target.value; if (m === 'ambulatory' || m === 'wheelchair' || m === 'stretcher') setMobility(m); }}><option value="ambulatory">Ambulatory</option><option value="wheelchair">Wheelchair</option><option value="stretcher">Stretcher</option></DsSelect>}</DsField>{q.isError && <p role="alert" className="ds-support">Patient settings unavailable for this account. Existing patients remain in Patients.</p>}<div className="sm:col-span-2"><DsButton type="submit" disabled={busy || preview.active || !q.data || !relationship}>Save patient information</DsButton></div></div></form>;
}
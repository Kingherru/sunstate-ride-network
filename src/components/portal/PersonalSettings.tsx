import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsCheckbox } from '@/components/ds/controls';
import { getPersonalSettings, savePersonalSettings } from '@/lib/account-settings.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';

export function PersonalSettings() {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const get = useServerFn(getPersonalSettings);
  const save = useServerFn(savePersonalSettings);
  const q = usePortalQuery({ queryKey: ['personal-settings'], queryFn: () => get() });
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [inApp, setInApp] = useState(true);
  const [email, setEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!q.data) return;
    setFirst(q.data.first_name ?? ''); setLast(q.data.last_name ?? ''); setPhone(q.data.phone ?? '');
    const p = q.data.notification_preferences as { in_app?: boolean; email?: boolean } | null;
    setInApp(p?.in_app ?? true); setEmail(p?.email ?? false);
  }, [q.data]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active) { previewBlocked(); return; }
    setBusy(true);
    try { await save({ data: { firstName, lastName, phone, preferences: { in_app: inApp, email } } }); await qc.invalidateQueries({ queryKey: ['personal-settings'] }); toast.success('Personal settings saved.'); }
    catch { toast.error('Could not save personal settings.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-4 max-w-2xl">
    <h2 className="ds-subheading uppercase text-ds-primary">Personal information</h2>
    {q.isLoading && <p role="status" className="ds-support">Loading…</p>}
    {q.isError && <p role="alert" className="ds-support rounded-ds-sm ds-status-red px-3 py-2">Account settings unavailable.</p>}
    {q.data?.display_name && !q.data.first_name && <p className="ds-support">Current name: {q.data.display_name}</p>}
    <dl className="grid gap-3 rounded-ds-sm bg-ds-sky p-3 sm:grid-cols-2">
      <div className="min-w-0"><dt className="ds-label">MFN ID</dt><dd className="ds-body font-mono">{q.data?.mfn_id ?? '—'}</dd></div>
      <div className="min-w-0"><dt className="ds-label">Account status</dt><dd className="ds-body">{q.data?.status ? q.data.status.replace(/_/g, ' ') : '—'}</dd></div>
      <p className="ds-caption sm:col-span-2">Read-only. Account type and role labels are managed by authorized administrators and never grant permissions on their own.</p>
    </dl>
    <div className="grid gap-4 sm:grid-cols-2">
      <DsField label="First name">{p => <DsInput {...p} required maxLength={80} autoComplete="given-name" value={firstName} onChange={e => setFirst(e.target.value)} />}</DsField>
      <DsField label="Last name">{p => <DsInput {...p} required maxLength={80} autoComplete="family-name" value={lastName} onChange={e => setLast(e.target.value)} />}</DsField>
      <DsField label="Phone number">{p => <DsInput {...p} type="tel" maxLength={32} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />}</DsField>
    </div>
    <fieldset className="space-y-3"><legend className="ds-label mb-2">Notification preferences</legend>
      <DsCheckbox label="In-app notifications" checked={inApp} onChange={e => setInApp(e.target.checked)} />
      <div><DsCheckbox label="Optional email notifications" checked={email} onChange={e => setEmail(e.target.checked)} /></div>
      <p className="ds-caption">Security and required transaction notices remain enabled.</p>
    </fieldset>
    <DsButton size="sm" disabled={busy || (!preview.active && !q.data)} type="submit">{busy ? 'Saving…' : 'Save settings'}</DsButton>
  </form>;
}
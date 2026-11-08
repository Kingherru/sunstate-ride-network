import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsCheckbox } from '@/components/ds/controls';
import { getPersonalSettings, savePersonalSettings } from '@/lib/account-settings.functions';
import { usePortalPreview, usePortalQuery, previewBlocked } from './preview-data';
import { StatusPill } from '@/components/ds/status';
import { useRouteContext } from '@tanstack/react-router';

export function PersonalSettings({ section = 'all' }: { section?: 'all' | 'profile' | 'notifications' | 'status' }) {
  const preview = usePortalPreview();
  const { access } = useRouteContext({ strict: false });
  const workspace = preview.active ? null : access?.primary;
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
  return <form onSubmit={submit} className="portal-business-form min-w-0 space-y-4">
    {q.isLoading && <p role="status" className="ds-support">Loading…</p>}
    {q.isError && <p role="alert" className="ds-support rounded-ds-sm ds-status-red px-3 py-2">Account settings unavailable.</p>}
    {section !== 'notifications' && q.data?.display_name && !q.data.first_name && <p className="ds-support">Current name: {q.data.display_name}</p>}
    {(section === 'all' || section === 'profile') && <><section className="portal-business-section">
      <h2 className="portal-business-heading ds-subheading uppercase">Profile</h2>
      <div className="portal-business-body grid gap-4 sm:grid-cols-2">
      <DsField label="First name">{p => <DsInput {...p} required maxLength={80} autoComplete="given-name" value={firstName} onChange={e => setFirst(e.target.value)} />}</DsField>
      <DsField label="Last name">{p => <DsInput {...p} required maxLength={80} autoComplete="family-name" value={lastName} onChange={e => setLast(e.target.value)} />}</DsField>
      </div>
    </section>
    <section className="portal-business-section">
      <h2 className="portal-business-heading ds-subheading uppercase">Contact information</h2>
      <div className="portal-business-body"><DsField label="Phone number">{p => <DsInput {...p} type="tel" maxLength={32} autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} />}</DsField></div>
    </section>
    </>}
    {(section === 'all' || section === 'status') && <section className="portal-business-section">
      <h2 className="portal-business-heading ds-subheading uppercase">Account status &amp; type</h2>
      <div className="portal-business-body space-y-3"><dl className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0"><dt className="ds-label">MFN ID</dt><dd className="ds-body break-words font-mono">{q.data?.mfn_id ?? '—'}</dd></div>
        <div className="min-w-0"><dt className="ds-label">Account status</dt><dd className="mt-1">{q.data?.status ? <StatusPill status={q.data.status} /> : '—'}</dd></div>
        {(preview.active || workspace) && <div className="min-w-0"><dt className="ds-label">Account name</dt><dd className="ds-body break-words">{preview.active ? 'Demo Account' : workspace?.name || '—'}</dd></div>}
        <div className="min-w-0"><dt className="ds-label">Account type / role</dt><dd className="ds-body break-words">{preview.active ? `${preview.kind === 'provider' ? 'Provider' : preview.accountType.replace(/_/g, ' ')} · Demo` : workspace ? `${workspace.is_contractor ? 'Contractor' : workspace.type.replace(/_/g, ' ')} · ${workspace.role.replace(/_/g, ' ')}` : access?.isMasterAdmin ? 'Master Admin' : access?.isAdmin ? 'Administrator' : 'Learner'}</dd></div>
      </dl><p className="ds-caption">Read-only. Account type and role labels are managed by authorized administrators and never grant permissions on their own.</p></div>
    </section>}
    {(section === 'all' || section === 'notifications') && <section className="portal-business-section">
      <h2 className="portal-business-heading ds-subheading uppercase">Notification preferences</h2>
      <fieldset className="portal-business-body space-y-3"><legend className="sr-only">Notification preferences</legend>
      <DsCheckbox label="Optional in-app Network opportunities" checked={inApp} onChange={e => setInApp(e.target.checked)} />
      <div><DsCheckbox label="Optional email notifications" checked={email} onChange={e => setEmail(e.target.checked)} /></div>
      <p className="ds-caption">Email preference is saved. No optional email category is currently connected to this setting.</p>
      <div className="border-t border-ds-border pt-3"><p className="ds-label">Required notices — always enabled</p><p className="ds-caption mt-1">Security, account access, billing and payments, disputes, deadlines, and active-trip operations cannot be disabled.</p></div>
      </fieldset>
    </section>}
    {section !== 'status' && <div className="portal-business-actions"><DsButton disabled={preview.active || busy || !q.data} type="submit">{busy ? 'Saving…' : 'Save settings'}</DsButton></div>}
  </form>;
}
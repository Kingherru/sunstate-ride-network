import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput, DsTextarea } from '@/components/ds/controls';
import { updateAdminPerson, setAdminPersonActive } from '@/lib/admin-person.functions';

type Profile = { first_name?: string | null; last_name?: string | null; phone?: string | null; status: string; is_test_account?: boolean };
type Contact = { postal_code?: string | null; city?: string | null } | null;

/** Correct permitted profile fields and deactivate/restore with a required reason. Server re-checks scope and Master Admin protection. */
export function PersonAccountActions({ userId, profile, contact, protectedAccount }: { userId: string; profile: Profile; contact: Contact; protectedAccount: boolean }) {
  const qc = useQueryClient();
  const router = useRouter();
  const save = useServerFn(updateAdminPerson), setActive = useServerFn(setAdminPersonActive);
  const [mode, setMode] = useState<null | 'edit' | 'status'>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', postal: '', city: '' });
  const [reason, setReason] = useState(''), [confirming, setConfirming] = useState(false), [busy, setBusy] = useState(false);
  const active = profile.status === 'active';
  if (protectedAccount) return <p className="ds-support">Master Admin account: protected from edits, deactivation and other admin actions.</p>;
  const restoreBlocked = !active && !!profile.is_test_account;
  function open(m: 'edit' | 'status') {
    setMode(m); setReason(''); setConfirming(false);
    if (m === 'edit') setForm({ firstName: profile.first_name || '', lastName: profile.last_name || '', phone: profile.phone || '', postal: contact?.postal_code || '', city: contact?.city || '' });
  }
  async function submit() {
    setBusy(true);
    try {
      if (mode === 'edit') await save({ data: { userId, ...form, reason } });
      else await setActive({ data: { userId, active: !active, reason } });
      toast.success(mode === 'edit' ? 'Account details saved and recorded.' : active ? 'Account deactivated; records preserved.' : 'Account restored.');
      setMode(null);
      await qc.invalidateQueries({ queryKey: ['admin-person', userId] });
      router.invalidate();
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Action unavailable.'); } finally { setBusy(false); }
  }
  const zipOk = /^(\d{5}(-\d{4})?)?$/.test(form.postal.trim());
  return <div>
    <div className="flex flex-wrap gap-2">
      <DsButton size="sm" variant="secondary" onClick={() => open('edit')}>Edit details</DsButton>
      <DsButton size="sm" variant="secondary" disabled={restoreBlocked} onClick={() => open('status')}>{active ? 'Deactivate account' : 'Restore account'}</DsButton>
    </div>
    {restoreBlocked && <p className="ds-support mt-2">Disabled test accounts stay disabled.</p>}
    {mode && <div className="mt-3 rounded-ds border border-ds-border bg-ds-surface p-4">
      {mode === 'edit' && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <DsField label="First name">{p => <DsInput {...p} maxLength={80} value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />}</DsField>
        <DsField label="Last name">{p => <DsInput {...p} maxLength={80} value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />}</DsField>
        <DsField label="Phone">{p => <DsInput {...p} maxLength={30} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />}</DsField>
        <DsField label="City">{p => <DsInput {...p} maxLength={80} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />}</DsField>
        <DsField label="ZIP code" error={zipOk ? undefined : 'Use 5 digits'}>{p => <DsInput {...p} inputMode="numeric" maxLength={10} value={form.postal} onChange={e => setForm({ ...form, postal: e.target.value })} />}</DsField>
      </div>}
      {mode === 'status' && <p>{active ? 'Deactivating suspends portal access. Trips, payments, messages, training and certificates are kept.' : 'Restoring returns portal access to this account.'}</p>}
      <div className="mt-3"><DsField label="Reason (required)">{p => <DsTextarea {...p} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />}</DsField></div>
      {!confirming
        ? <div className="mt-3 flex gap-2"><DsButton size="sm" disabled={reason.trim().length < 3 || !zipOk} onClick={() => setConfirming(true)}>{mode === 'edit' ? 'Save' : 'Continue'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setMode(null)}>Cancel</DsButton></div>
        : <div role="alertdialog" aria-label="Confirm" className="mt-3 rounded-ds border border-ds-sky-border bg-ds-sky p-3"><p>Confirm? This is recorded with your MFN ID and the time.</p><div className="mt-2 flex gap-2"><DsButton size="sm" disabled={busy} onClick={submit}>{busy ? 'Saving…' : 'Confirm'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setConfirming(false)}>Back</DsButton></div></div>}
    </div>}
  </div>;
}

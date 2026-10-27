import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsInput } from '@/components/ds/controls';
import { requestSecureEmailChange, confirmSecureEmailChange } from '@/lib/email-change.functions';
import { usePortalPreview, previewBlocked } from './preview-data';

export function SecureEmailChange() {
  const preview = usePortalPreview(); const qc = useQueryClient();
  const request = useServerFn(requestSecureEmailChange), confirm = useServerFn(confirmSecureEmailChange);
  const [newEmail, setNewEmail] = useState(''), [password, setPassword] = useState(''), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [requested, setRequested] = useState(false), [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (preview.active) { previewBlocked(); return; }
    setBusy(true); setError('');
    try {
      const result = await request({ data: { newEmail, currentPassword: password || undefined } });
      if ('error' in result) { setError(result.error); return; }
      setRequested(true); toast.success('Confirm the change using the messages sent to your old and new email addresses.');
      await qc.invalidateQueries({ queryKey: ['personal-security-audit'] });
    } catch { setError('Email change is unavailable. Your current email remains active.'); }
    finally { setPassword(''); setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); if (preview.active) { previewBlocked(); return; }
    setBusy(true); setError('');
    try {
      const result = await confirm({ data: { email: newEmail, code } });
      if ('error' in result) setError(result.error);
      else { toast.success(result.confirmed ? 'Email confirmed. Sign in again with your updated email.' : 'Confirmation received. Complete confirmation from both email addresses.'); await qc.invalidateQueries(); }
    } catch { setError('Confirmation could not be completed.'); }
    finally { setCode(''); setBusy(false); }
  }
  return <section className="space-y-4">
    <h2 className="ds-subheading uppercase text-ds-primary">Verified email change</h2>
    <p className="ds-support">Your current email remains active until secure confirmation is complete. Your account, permissions and purchases stay unchanged.</p>
    <form onSubmit={submit} className="space-y-3">
      <DsField label="New email">{p => <DsInput {...p} type="email" autoComplete="email" required value={newEmail} onChange={e => setNewEmail(e.target.value)} />}</DsField>
      <DsField label="Current password" hint="Or sign in again and request the change within five minutes.">{p => <DsInput {...p} type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />}</DsField>
      <DsButton type="submit" size="sm" disabled={busy || preview.active}>{busy ? 'Please wait…' : 'Request email change'}</DsButton>
    </form>
    {requested && <form onSubmit={verify} className="space-y-3">
      <p className="ds-support">Use the secure confirmation links in both emails. If your message includes a code, enter it below.</p>
      <DsField label="Confirmation code">{p => <DsInput {...p} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,8}" required value={code} onChange={e => setCode(e.target.value)} />}</DsField>
      <DsButton type="submit" size="sm" variant="secondary" disabled={busy}>Confirm code</DsButton>
    </form>}
    {error && <p role="alert" className="ds-support text-ds-error">{error}</p>}
  </section>;
}
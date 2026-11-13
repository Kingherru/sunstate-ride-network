import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsField, DsSelect } from '@/components/ds/controls';
import { getSignInPreference, saveSignInPreference } from '@/lib/sign-in-preference.functions';
import { usePortalPreview, usePortalQuery } from './preview-data';

export function SignInPreference() {
  const preview = usePortalPreview();
  const get = useServerFn(getSignInPreference);
  const save = useServerFn(saveSignInPreference);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['sign-in-preference'], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  async function change(page: string) {
    if (preview.active) return;
    setBusy(true);
    try { await save({ data: { page: page || null } }); await qc.invalidateQueries({ queryKey: ['sign-in-preference'] }); toast.success('Sign-in page saved.'); }
    catch { toast.error('Could not save sign-in page.'); } finally { setBusy(false); }
  }
  return <section className="portal-business-section"><h3 className="portal-business-heading ds-label">Sign-in preference</h3><div className="portal-business-body"><DsField label="Page after sign in">{p => <DsSelect {...p} value={q.data?.value ?? ''} disabled={busy || preview.active || !q.data} onChange={e => void change(e.target.value)}><option value="">Default</option>{q.data?.options.map(o => <option key={o.to} value={o.to}>{o.label}</option>)}</DsSelect>}</DsField>{q.isError && <p role="alert" className="ds-support">Sign-in preference unavailable.</p>}</div></section>;
}
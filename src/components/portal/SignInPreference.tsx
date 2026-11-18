import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsSelect } from '@/components/ds/controls';
import { getSignInPreference, saveSignInPreference } from '@/lib/sign-in-preference.functions';
import { usePortalPreview, usePortalQuery } from './preview-data';

export function SignInPreference() {
  const preview = usePortalPreview();
  const get = useServerFn(getSignInPreference);
  const save = useServerFn(saveSignInPreference);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ['sign-in-preference'], queryFn: () => get() });
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { setPage(q.data?.value ?? ''); }, [q.data]);
  const dirty = page !== (q.data?.value ?? '');
  const valid = page === '' || !!q.data?.options.some(option => option.to === page);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active || busy || !q.data || !dirty || !valid) return;
    setBusy(true); setMessage('');
    try { await save({ data: { page: page || null } }); await qc.invalidateQueries({ queryKey: ['sign-in-preference'] }); setMessage('Changes saved.'); toast.success('Sign-in page saved.'); }
    catch { setMessage('Could not save. Your saved sign-in page is unchanged.'); toast.error('Could not save sign-in page.'); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="portal-business-section"><h3 className="portal-business-heading ds-label">Sign-in preference</h3><div className="portal-business-body space-y-4"><DsField label="Page shown after sign in">{p => <DsSelect {...p} value={page} disabled={busy || !q.data} onChange={e => {setPage(e.target.value);setMessage('');}}><option value="">Overview (default)</option>{q.data?.options.filter(o => o.label !== 'Overview').map(o => <option key={o.to} value={o.to}>{o.label}</option>)}</DsSelect>}</DsField>{q.isError && <p role="alert" className="ds-support">Sign-in preference unavailable.</p>}<p role="status" className="ds-caption">{preview.active ? 'Preview mode — nothing is saved.' : message || (dirty ? valid ? 'Unsaved changes.' : 'Choose an available page.' : '')}</p></div><div className="portal-business-actions"><DsButton type="submit" disabled={preview.active || busy || !q.data || !dirty || !valid}>{busy ? 'Saving…' : 'Save Changes'}</DsButton><DsButton type="button" variant="ghost" disabled={busy || !dirty} onClick={() => {setPage(q.data?.value ?? '');setMessage('');}}>Cancel</DsButton></div></form>;
}

import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { toast } from 'sonner';
import { Send, UserMinus } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { DsButton, DsField, DsInput, DsSelect, DsTextarea } from '@/components/ds/controls';
import { getAdminPerson, prepareUserRemoval, removeUserAccess, messageAdminPerson } from '@/lib/admin-person.functions';
import type { PersonRow } from '@/lib/portal-account.functions';
import { useRequestDetails } from '@/components/portal/request-detail-context';
import { useAdminLevel } from '@/lib/use-admin-level';
import { useRouteContext } from '@tanstack/react-router';

export function PersonDetails({ person, canManage, onClose }: { person: PersonRow; canManage: boolean; onClose: () => void }) {
  const canMessage = useAdminLevel('messaging') === 'manage';
  const master = useRouteContext({ from: '/_authenticated/admin', select: c => c.perms.isMaster });
  const get = useServerFn(getAdminPerson), prepare = useServerFn(prepareUserRemoval), remove = useServerFn(removeUserAccess), send = useServerFn(messageAdminPerson);
  const q = useQuery({ queryKey: ['admin-person', person.userId], queryFn: () => get({ data: { userId: person.userId } }), gcTime: 0 });
  const open = useRequestDetails();
  const router = useRouter();
  const [compose, setCompose] = useState(false), [body, setBody] = useState(''), [workspace, setWorkspace] = useState(person.accounts[0]?.id || '');
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof prepare>> | null>(null);
  const [step, setStep] = useState(0), [reason, setReason] = useState(''), [confirmation, setConfirmation] = useState(''), [busy, setBusy] = useState(false);
  async function beginRemoval() { try { setPlan(await prepare({ data: { userId: person.userId } })); setStep(1); } catch (e) { toast.error(e instanceof Error ? e.message : 'Action unavailable.'); } }
  async function finishRemoval() {
    if (!plan) return;
    setBusy(true);
    try { await remove({ data: { userId: person.userId, mode: plan.mode, reason, confirmedMfn: confirmation } }); toast.success('Login access removed; historical records preserved.'); router.invalidate(); onClose(); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Action unavailable.'); } finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="theme-portal !max-w-4xl max-h-[92dvh] overflow-y-auto !bg-ds-surface !text-ds-on-surface !rounded-ds">
    <DialogTitle className="!tracking-normal text-ds-primary">{person.name || person.email || 'Account details'}</DialogTitle><DialogDescription>{person.mfnId} · {person.status} · {canManage ? 'Manage' : 'Read-only'}</DialogDescription>
    {q.isPending ? <p>Loading account…</p> : q.error ? <p role="alert">Account details unavailable.</p> : q.data && <div className="space-y-5">
      <section><h3 className="ds-subheading text-ds-primary">Contact and verification</h3><p>{q.data.email || 'No email'} · {q.data.profile.phone || q.data.contact?.phone || 'No phone recorded'}</p><p>{q.data.verified ? 'Email verified' : 'Email not verified'} · {q.data.profile.deleted_at ? 'Deleted / inactive' : person.needsReview ? 'Needs Review' : person.status}</p><p className="ds-support">Created {q.data.profile.created_at ? new Date(q.data.profile.created_at).toLocaleDateString() : '—'} · Last sign-in {q.data.lastSignIn ? new Date(q.data.lastSignIn).toLocaleString() : 'Not recorded'}</p></section>
      <section><h3 className="ds-subheading text-ds-primary">Accounts and roles</h3>{person.accounts.map(a => <p key={a.id}>{a.name || a.type} · {a.mfnId} · {a.type} / {a.orgType} · {a.role} · {a.status}</p>)}<p>{person.roles.join(', ') || 'No platform role'}</p><p className="ds-support">Membership: {q.data.contact?.membership_tier || 'Not recorded'} · {q.data.contact?.membership_status || '—'}</p></section>
      <section><h3 className="ds-subheading text-ds-primary">Related requests and trips</h3><div className="flex flex-wrap gap-2">{q.data.requests.map(r => <DsButton key={r.id} variant="ghost" onClick={() => { onClose(); open({ kind: 'request', id: r.id }); }}>{r.mfn_id} · {r.status}</DsButton>)}{q.data.trips.map(t => <DsButton key={t.id} variant="ghost" onClick={() => { onClose(); open({ kind: 'trip', id: t.id }); }}>{t.display_id || 'Trip'} · {t.status}</DsButton>)}</div>{!q.data.requests.length && !q.data.trips.length && <p className="ds-support">No related records available in your scope.</p>}</section>
      <section><h3 className="ds-subheading text-ds-primary">Training summary</h3><p>{q.data.training === null ? 'Training purchases not available in your scope' : `${q.data.training} course enrollments`} · {q.data.certificates === null ? 'Certificate summary unavailable' : `${q.data.certificates} certificates`}</p></section>
      <div className="flex flex-wrap gap-3">{canMessage && <DsButton variant="secondary" onClick={() => setCompose(!compose)}><Send className="size-4" />Send message</DsButton>}{canManage && !person.isMasterAdmin && <DsButton variant="ghost" onClick={beginRemoval}><UserMinus className="size-4" />Remove login access</DsButton>}</div>
      {compose && <form className="space-y-3 border-t border-ds-border pt-4" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await send({ data: { userId: person.userId, workspaceId: workspace || null, body } }); toast.success('In-app message sent.'); setBody(''); setCompose(false); } catch (err) { toast.error(err instanceof Error ? err.message : 'Message unavailable.'); } finally { setBusy(false); } }}><DsField label="Related account">{p => <DsSelect {...p} value={workspace} onChange={e => setWorkspace(e.target.value)}><option value="" disabled={!master}>Person only</option>{person.accounts.map(a => <option key={a.id} value={a.id}>{a.name || a.type} · {a.mfnId}</option>)}</DsSelect>}</DsField><DsField label="Message">{p => <DsTextarea {...p} required maxLength={5000} value={body} onChange={e => setBody(e.target.value)} />}</DsField><DsButton disabled={busy} type="submit"><Send className="size-4" />Send in app</DsButton></form>}
      {plan && step > 0 && <section className="space-y-3 bg-ds-surface-muted p-4 rounded-ds"><h3 className="ds-subheading">{plan.mode === 'delete' ? 'Removable account deletion' : 'Protected-record deactivation'}</h3><p>{person.name || person.email} · {person.mfnId}</p><p>{person.accounts.map(a => `${a.name || a.type} (${a.mfnId})`).join(', ') || 'No workspace'}</p><p>{plan.mode === 'delete' ? 'Login will be permanently removed. Profile is marked deleted and memberships become inactive.' : `Login will be disabled. ${plan.protected_records} historical references remain intact; MFN ID, profile and records are preserved.`}</p><DsField label="Reason">{p => <DsTextarea {...p} minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />}</DsField>{step === 1 ? <DsButton disabled={reason.trim().length < 5} onClick={() => setStep(2)}>Review final confirmation</DsButton> : <><DsField label="Type the person's MFN ID to confirm">{p => <DsInput {...p} value={confirmation} onChange={e => setConfirmation(e.target.value)} />}</DsField><DsButton disabled={busy || confirmation !== plan.mfn_id || reason.trim().length < 5} onClick={finishRemoval}>Confirm {plan.mode === 'delete' ? 'login deletion' : 'deactivation'}</DsButton></>}<DsButton variant="ghost" onClick={() => { setPlan(null); setStep(0); }}>Cancel</DsButton></section>}
    </div>}
  </DialogContent></Dialog>;
}
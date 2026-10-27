import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { DsButton, DsField, DsSelect, DsTextarea } from '@/components/ds/controls';
import { pauseProviderBadge } from '@/lib/provider-verification.functions';
import { ProviderVerificationBadge } from '@/components/portal/ProviderVerificationBadge';
import { useAdminLevel } from '@/lib/use-admin-level';
import { VerificationEvidence } from '@/components/portal/VerificationEvidence';
export function ProviderBadgeControl({ workspaceId, protectedAccount }: { workspaceId: string; protectedAccount: boolean }) {
  const level = useAdminLevel('membership'); const pause = useServerFn(pauseProviderBadge); const qc = useQueryClient();
  const [open, setOpen] = useState(false), [category, setCategory] = useState<'payment' | 'compliance' | 'security'>('payment'), [reason, setReason] = useState(''), [busy, setBusy] = useState(false);
  return <div className="space-y-2 mt-2"><ProviderVerificationBadge workspaceId={workspaceId} />
    {level !== 'none' && <details><summary className="ds-support cursor-pointer">Verification requirements</summary><VerificationEvidence workspaceId={workspaceId} /></details>}
    {level === 'manage' && !protectedAccount && <DsButton size="sm" variant="ghost" onClick={() => setOpen(true)}>Pause badge…</DsButton>}
    {open && <div role="dialog" aria-modal="true" aria-label="Confirm provider badge pause" className="fixed inset-0 z-50 flex items-center justify-center bg-ds-primary/50 p-4"><form className="w-full max-w-lg space-y-4 rounded-ds bg-ds-surface p-6" onSubmit={async e => { e.preventDefault(); setBusy(true); try { await pause({ data: { workspaceId, category, reason, confirmed: true } }); setOpen(false); setReason(''); await qc.invalidateQueries({ queryKey: ['provider-badges'] }); toast.success('Badge paused with a permanent audit entry.'); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>
      <h3 className="ds-subheading text-ds-primary">Confirm provider badge pause</h3>
      <DsField label="Issue category">{p => <DsSelect {...p} value={category} onChange={e => setCategory(e.target.value as typeof category)}><option value="payment">Payment</option><option value="compliance">Compliance</option><option value="security">Security</option></DsSelect>}</DsField>
      <DsField label="Documented reason" hint="Do not include payment credentials or private passenger information.">{p => <DsTextarea {...p} required minLength={10} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} />}</DsField>
      <div className="flex justify-end gap-2"><DsButton type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>Cancel</DsButton><DsButton type="submit" disabled={busy}>Confirm pause</DsButton></div>
    </form></div>}
  </div>;
}
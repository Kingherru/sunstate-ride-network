import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { DsButton, DsTextarea } from '@/components/ds/controls';
import { getRequestLifecycle, transitionRequest } from '@/lib/request-lifecycle.functions';
import { LIFECYCLE_LABEL, adminNextStates, isLifecycleState, type LifecycleState } from '@/lib/request-lifecycle';

const fmt = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
const label = (s: string | null) => (s && isLifecycleState(s) ? LIFECYCLE_LABEL[s] : 'Not Available');

/** Status, admin status actions (confirmed + audited server-side) and append-only history. */
export function RequestLifecycle({ requestId, canManage }: { requestId: string; canManage: boolean }) {
  const qc = useQueryClient();
  const load = useServerFn(getRequestLifecycle);
  const move = useServerFn(transitionRequest);
  const q = useQuery({ queryKey: ['request-lifecycle', requestId], queryFn: () => load({ data: { id: requestId } }) });
  const [pending, setPending] = useState<LifecycleState | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (q.isPending) return <p role="status">Loading status…</p>;
  if (q.error || !q.data) return <p role="alert" className="text-ds-error">Status unavailable.</p>;
  const state = isLifecycleState(q.data.state) ? q.data.state : 'submitted';
  // Distribution is disconnected until a separately approved build; never claim an offer was sent.
  const next = adminNextStates(state).filter((s) => s !== 'distributed');

  async function confirm() {
    if (!pending) return;
    setBusy(true); setMsg('');
    const r = await move({ data: { id: requestId, to: pending, note: note || undefined } });
    setBusy(false);
    if (!r.ok) { setMsg(r.error); return; }
    setPending(null); setNote('');
    await qc.invalidateQueries({ queryKey: ['request-lifecycle', requestId] });
  }

  return (
    <section className="rounded-ds border border-ds-border bg-ds-surface p-5" aria-label="Request status and history">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ds-border pb-3">
        <h2 className="ds-subheading text-ds-primary">Status: {LIFECYCLE_LABEL[state]}</h2>
        <p className="ds-caption">Automatic distribution: {q.data.autoDistribution ? 'On' : 'Off until launch'}</p>
      </div>
      {canManage && next.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {next.map((s) => <DsButton key={s} size="sm" variant={s === 'cancelled' || s === 'declined' ? 'ghost' : 'secondary'} onClick={() => { setPending(s); setMsg(''); }}>{LIFECYCLE_LABEL[s]}</DsButton>)}
        </div>
      )}
      {canManage && <p className="ds-support mt-2">Distributed: distribution connection pending — not available in this build.</p>}
      {pending && (
        <div role="dialog" aria-label="Confirm status change" className="mt-3 rounded-ds border border-ds-sky-border bg-ds-sky p-4">
          <p>Change status from <strong>{LIFECYCLE_LABEL[state]}</strong> to <strong>{LIFECYCLE_LABEL[pending]}</strong>? This is recorded with your MFN ID.</p>
          <DsTextarea aria-label="Optional note" placeholder="Optional note (no medical details)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-2" />
          <div className="mt-2 flex gap-2"><DsButton size="sm" disabled={busy} onClick={confirm}>{busy ? 'Saving…' : 'Confirm'}</DsButton><DsButton size="sm" variant="ghost" onClick={() => setPending(null)}>Cancel</DsButton></div>
        </div>
      )}
      {msg && <p role="alert" className="mt-2 text-ds-error">{msg}</p>}
      <h3 className="ds-label mt-4">History</h3>
      {q.data.events.length === 0 ? <p className="ds-support">No status changes recorded yet.</p> : (
        <ol className="mt-2 divide-y divide-ds-border">
          {q.data.events.map((e) => <li key={e.id} className="py-2"><span className="font-semibold">{label(e.from_state)} → {label(e.to_state)}</span> · {e.actor_mfn_id ?? 'Not Available'} · {fmt(e.created_at)}{e.note && <p className="ds-support">{e.note}</p>}</li>)}
        </ol>
      )}
    </section>
  );
}

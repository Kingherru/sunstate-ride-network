import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { getAdminWorkspaceMembership, listMembershipTransitions } from '@/lib/membership.functions';
import { ADDON_STATUS_LABEL, BASE_STATUS_LABEL, money } from '@/lib/membership-pricing';

const date = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium' }) : 'Not Available');

/** Read-only: no charge, refund, subscription edit, card view or activation control. */
export function AdminMembershipSummary({ workspaceId }: { workspaceId: string }) {
  const get = useServerFn(getAdminWorkspaceMembership);
  const q = useQuery({ queryKey: ['admin-membership', workspaceId], queryFn: () => get({ data: { workspaceId } }) });
  if (q.isLoading) return <p className="ds-support">Loading membership…</p>;
  if (q.isError || !q.data) return <p className="ds-support">Membership summary not available in your scope.</p>;
  const s = q.data;
  return <dl className="ds-support mt-2 grid gap-x-4 gap-y-1 rounded-ds bg-ds-surface-muted p-3 sm:grid-cols-2">
    <div><dt className="inline font-semibold">Base: </dt><dd className="inline">{BASE_STATUS_LABEL[s.base]}{s.legacy ? ' (former $10)' : ''}</dd></div>
    <div><dt className="inline font-semibold">Network add-on: </dt><dd className="inline">{s.legacy ? 'Included until renewal' : ADDON_STATUS_LABEL[s.addon]}</dd></div>
    <div><dt className="inline font-semibold">Trial ends: </dt><dd className="inline">{date(s.trialEnd)}</dd></div>
    <div><dt className="inline font-semibold">Renews: </dt><dd className="inline">{date(s.renewalAt)}</dd></div>
    <div><dt className="inline font-semibold">Recurring: </dt><dd className="inline">{s.items.length ? `${s.items.map(i => `${i.label} ${money(i.cents)}`).join(' + ')} = ${money(s.totalCents)}` : 'None'}</dd></div>
    <div><dt className="inline font-semibold">Billing linkage: </dt><dd className="inline">{s.stripeLinked ? `Linked (${s.environment === 'live' ? 'live' : 'test'})` : 'Not linked'}</dd></div>
    <div><dt className="inline font-semibold">Latest payment: </dt><dd className="inline">{s.latestPayment?.state ?? 'Not Available'}{s.latestPayment?.paidAt ? ` · ${date(s.latestPayment.paidAt)}` : ''}</dd></div>
    {(s.transition || s.needsReviewReason) && <div className="sm:col-span-2"><dt className="inline font-semibold">Transition / review: </dt><dd className="inline">{s.needsReviewReason ?? `${s.transition!.status} → ${money(s.transition!.proposedCents)} at ${date(s.transition!.renewalAt)}`}</dd></div>}
  </dl>;
}

export function MembershipTransitionsList() {
  const get = useServerFn(listMembershipTransitions);
  const q = useQuery({ queryKey: ['membership-transitions'], queryFn: () => get(), retry: false });
  if (q.isError) return null;
  const rows = (q.data?.rows ?? []) as any[];
  return <section className="rounded-ds border border-ds-border bg-ds-surface p-4" aria-labelledby="mt-h">
    <h2 id="mt-h" className="ds-subheading uppercase text-ds-primary">Membership renewal transitions</h2>
    <p className="ds-support mt-1">Read-only. Launch flag is {q.data?.enabled ? 'ON' : 'OFF'}; transitions cannot be activated here.</p>
    {q.isLoading ? <p className="ds-support mt-2">Loading…</p> : rows.length === 0 ? <p className="ds-support mt-2">No prepared transitions.</p> : (
      <ul className="ds-support mt-3 divide-y divide-ds-border">{rows.map(r => <li key={r.id} className="py-2">{r.workspaces?.display_name ?? 'Business'} · {r.workspaces?.mfn_id ?? '—'} · {r.current_cents != null ? money(r.current_cents) : '—'} → {money(r.proposed_cents)} · renews {date(r.renewal_at)} · {r.status}{r.reason ? ` · ${r.reason}` : ''}</li>)}</ul>
    )}
  </section>;
}

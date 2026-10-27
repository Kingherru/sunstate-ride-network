import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { DetailOverlayFrame } from './DetailOverlayFrame';
import { RequestDetail, fmtDateTime, isDelivery } from '@/components/portal/request-display';
import { RequestDetailContext, type DetailTarget } from './request-detail-context';
import { getAuthorizedRequestDetail } from '@/lib/portal-requests.functions';
import { markRequestViewed } from '@/lib/request-lifecycle.functions';
import { usePortalPreview, previewBlocked } from './preview-data';
import { DetailSection } from './DetailSection';
import { RequestLifecycle } from './RequestLifecycle';
import { AdminRequestActions } from './AdminRequestActions';
import { useAdminLevel } from '@/lib/use-admin-level';

const money = (c: number) => (c / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
const words = (s: string) => s.replaceAll('_', ' ');

function titleFor(t: DetailTarget, delivery: boolean) {
  if (t.context === 'draft') return 'Draft Details';
  if (t.context === 'referral' || t.context === 'network') return 'Referral Details';
  if (delivery) return 'Delivery Details';
  return t.kind === 'trip' ? 'Trip Details' : 'Request Details';
}

function AdminLifecycle({ id }: { id: string }) {
  const level = useAdminLevel('requests');
  return <RequestLifecycle requestId={id} canManage={level === 'manage'} />;
}

export function RequestDetailProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const preview = usePortalPreview();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAdmin = pathname.startsWith('/admin') && !pathname.startsWith('/admin/preview');
  const isProviderPortal = pathname.startsWith('/portal');
  const get = useServerFn(getAuthorizedRequestDetail);
  const viewed = useServerFn(markRequestViewed);
  const recorded = useRef(new Set<string>());
  const q = useQuery({ queryKey: ['request-overlay', target], queryFn: () => target ? get({ data: target }) : null, enabled: !!target, gcTime: 0 });

  // Provider Viewed: only on an explicit open in the live portal, once per request.
  // The database records it only for the selected provider business while Distributed.
  const loadedId = q.data?.ok && target?.kind === 'request' ? String(q.data.request.id) : null;
  useEffect(() => {
    if (!loadedId || !isProviderPortal || preview.active || recorded.current.has(loadedId)) return;
    recorded.current.add(loadedId);
    viewed({ data: { id: loadedId } }).catch(() => {});
  }, [loadedId, isProviderPortal, preview.active, viewed]);

  const ok = q.data?.ok ? q.data : null;
  const delivery = ok ? isDelivery(ok.request) : false;
  const requestId = ok ? (target?.kind === 'request' ? String(ok.request.id) : ok.request.ride_request_id ? String(ok.request.ride_request_id) : null) : null;
  return <RequestDetailContext.Provider value={t => { if (preview.active) { previewBlocked(); return; } setTarget(t); }}>
    {children}
    {target && <DetailOverlayFrame onClose={() => setTarget(null)} title={ok ? titleFor(target, delivery) : 'Information'} idLabel={ok ? ok.request.mfn_id || null : null}>
        {q.isPending ? <p role="status">Loading details…</p> : q.error || !ok ? <p role="alert">Details not available.</p> : <div className="space-y-6">
          {ok.request.deactivated_at && <DetailSection tone="warning" title="Deactivated"><p>This request was deactivated on {fmtDateTime(String(ok.request.deactivated_at))}. All history is preserved.</p></DetailSection>}
          <RequestDetail r={ok.request} showSource />
          <div className="grid gap-6 lg:grid-cols-2">
            <DetailSection tone="contact" title="Request account"><p className="ds-body">{ok.account ? `${ok.account.display_name} · ${ok.account.mfn_id}` : 'Not Available'}</p></DetailSection>
            <DetailSection title="Assignment and activity">
              <p className="ds-body">{ok.assignment || 'Not Available'}</p>
              {ok.history.length > 0 && <ol className="mt-2 divide-y divide-ds-sky-border">{ok.history.map((h, i) => <li key={i} className="ds-support py-2">{words(h.action)} · {fmtDateTime(h.at)}{h.actor ? ` · ${h.actor}` : ''}</li>)}</ol>}
            </DetailSection>
          </div>
          {ok.distributions.length > 0 && <DetailSection tone="payment" title="Distribution waves and offers">{ok.distributions.map(d => <div key={d.id} className="mt-3 border-t border-ds-green-border pt-3 first:mt-0 first:border-0 first:pt-0"><p className="ds-label">{d.mfn_id} · {words(d.status)}</p>{d.waves.map(w => <p key={w.id} className="ds-support">{w.radius_miles}-mile wave · {fmtDateTime(w.sent_at)}</p>)}{d.offers.map(o => <p key={o.id} className="ds-support">{o.mfn_id} · {words(o.status)} · {Number.isFinite(o.amount_cents) ? money(o.amount_cents) : 'Not Available'}</p>)}{d.negotiations.map(n => <p key={n.id} className="ds-support mt-2">{n.side} · {words(n.action)}{n.amount_cents != null ? ` · ${money(n.amount_cents)}` : ''} · {fmtDateTime(n.created_at)}</p>)}</div>)}</DetailSection>}
          {isAdmin && requestId && <AdminLifecycle id={requestId} />}
          {isAdmin && target.kind === 'request' && <AdminRequestActions r={ok.request} delivery={delivery} />}
        </div>}
    </DetailOverlayFrame>}
  </RequestDetailContext.Provider>;
}

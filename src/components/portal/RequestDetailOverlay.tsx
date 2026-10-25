import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { DetailOverlayFrame } from './DetailOverlayFrame';
import { RequestDetail } from '@/components/portal/request-display';
import { RequestDetailContext, type DetailTarget } from './request-detail-context';
import { getAuthorizedRequestDetail } from '@/lib/portal-requests.functions';
import { usePortalPreview, previewBlocked } from './preview-data';

export function RequestDetailProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<DetailTarget | null>(null);
  const preview = usePortalPreview();
  const get = useServerFn(getAuthorizedRequestDetail);
  const q = useQuery({ queryKey: ['request-overlay', target], queryFn: () => target ? get({ data: target }) : null, enabled: !!target, gcTime: 0 });
  return <RequestDetailContext.Provider value={t => { if (preview.active) { previewBlocked(); return; } setTarget(t); }}>
    {children}
    {target && <DetailOverlayFrame onClose={() => setTarget(null)} title={q.data?.ok ? q.data.request.mfn_id || 'Request details' : 'Request details'}>
        {q.isPending ? <p>Loading details…</p> : q.error || !q.data?.ok ? <p role="alert">Request not available.</p> : <>
          <RequestDetail r={q.data.request} showSource />
          {q.data.account && <section className="border-t border-ds-border py-4"><h3 className="ds-subheading text-ds-primary">Request account</h3><p>{q.data.account.display_name} · {q.data.account.mfn_id}</p></section>}
          {q.data.distributions.length > 0 && <section className="border-t border-ds-border py-4"><h3 className="ds-subheading text-ds-primary">Distribution waves and offers</h3>{q.data.distributions.map(d => <div key={d.id} className="mt-3"><p className="ds-label">{d.mfn_id} · {d.status.replaceAll('_', ' ')}</p>{d.waves.map(w => <p key={w.id} className="ds-support">{w.radius_miles}-mile wave · {new Date(w.sent_at).toLocaleString()}</p>)}{d.offers.map(o => <p key={o.id} className="ds-support">{o.mfn_id} · {o.status.replaceAll('_', ' ')} · {Number.isFinite(o.amount_cents) ? (o.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : 'NOT AVAILABLE'}</p>)}{d.negotiations.map(n => <p key={n.id} className="ds-support mt-2">{n.side} · {n.action.replaceAll('_', ' ')}{n.amount_cents != null ? ` · ${(n.amount_cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}` : ''} · {new Date(n.created_at).toLocaleString()}</p>)}</div>)}</section>}
          <section className="border-t border-ds-border py-4"><h3 className="ds-subheading text-ds-primary">Assignment and activity</h3>
            <p className="ds-body">{q.data.assignment || 'NOT AVAILABLE'}</p>
            {q.data.history.map((h, i) => <p key={i} className="ds-support mt-2">{h.action.replaceAll('_', ' ')} · {new Date(h.at).toLocaleString()}{h.actor ? ` · ${h.actor}` : ''}</p>)}
          </section>
        </>}
    </DetailOverlayFrame>}
  </RequestDetailContext.Provider>;
}
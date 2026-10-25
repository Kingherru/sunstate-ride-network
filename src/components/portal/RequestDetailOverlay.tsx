import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
    <Dialog open={!!target} onOpenChange={open => { if (!open) setTarget(null); }}>
      <DialogContent className="theme-portal !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none overflow-y-auto !rounded-none !border-ds-border !bg-ds-bg !text-ds-on-bg sm:!h-[90dvh] sm:!w-[94vw] sm:!max-w-6xl sm:!rounded-ds">
        <DialogTitle className="!tracking-normal text-ds-primary">{q.data?.ok ? q.data.request.mfn_id || 'Request details' : 'Request details'}</DialogTitle>
        <DialogDescription className="sr-only">Authorized request information and activity</DialogDescription>
        {q.isPending ? <p>Loading details…</p> : q.error || !q.data?.ok ? <p role="alert">Request not available.</p> : <>
          <RequestDetail r={q.data.request} showSource />
          <section className="border-t border-ds-border py-4"><h3 className="ds-subheading text-ds-primary">Assignment and activity</h3>
            <p className="ds-body">{q.data.assignment || 'No selected provider recorded'}</p>
            {q.data.history.map((h, i) => <p key={i} className="ds-support mt-2">{h.action.replaceAll('_', ' ')} · {new Date(h.at).toLocaleString()}{h.actor ? ` · ${h.actor}` : ''}</p>)}
          </section>
        </>}
      </DialogContent>
    </Dialog>
  </RequestDetailContext.Provider>;
}
import { DetailPresentation } from './DetailPresentation';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function DetailOverlayFrame({ title, idLabel, onClose, children }: { title: string; idLabel?: string | null; onClose: () => void; children: React.ReactNode }) {
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}><DialogContent largeWindow className="theme-portal portal-detail-frame ds-canvas-texture !border-2 !border-ds-primary !bg-ds-bg !text-ds-on-bg">
    <div className="shrink-0 bg-ds-surface">
      <DialogTitle className="!tracking-normal break-words uppercase text-ds-primary">{title}</DialogTitle>
      <DialogDescription className="ds-support mt-1">{idLabel ? <>MFN ID <span className="font-semibold text-ds-primary">{idLabel}</span></> : 'MFN ID Not Available'}</DialogDescription>
    </div>
    <div className="min-h-0 min-w-0"><DetailPresentation>{children}</DetailPresentation></div>
  </DialogContent></Dialog>;
}

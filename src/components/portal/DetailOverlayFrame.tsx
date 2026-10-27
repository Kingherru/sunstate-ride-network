import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function DetailOverlayFrame({ title, idLabel, onClose, children }: { title: string; idLabel?: string | null; onClose: () => void; children: React.ReactNode }) {
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="theme-portal !flex !flex-col !gap-0 !p-0 !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none overflow-hidden !rounded-none !border-ds-border !border-t-4 !border-t-ds-primary !bg-ds-bg !text-ds-on-bg sm:!h-[92dvh] sm:!w-[94vw] sm:!max-w-none sm:!rounded-ds [&>button]:!top-4 [&>button]:!right-5 [&>button]:!p-2 [&>button]:!bg-ds-surface [&>button]:!opacity-100">
    <div className="shrink-0 border-b border-ds-border bg-ds-surface px-5 py-4 pr-16">
      <DialogTitle className="!tracking-normal break-words uppercase text-ds-primary">{title}</DialogTitle>
      <DialogDescription className="ds-support mt-1">{idLabel ? <>MFN ID <span className="font-semibold text-ds-primary">{idLabel}</span></> : 'MFN ID Not Available'}</DialogDescription>
    </div>
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</div>
  </DialogContent></Dialog>;
}

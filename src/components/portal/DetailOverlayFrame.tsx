import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export function DetailOverlayFrame({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <Dialog open onOpenChange={v => { if (!v) onClose(); }}><DialogContent className="theme-portal !h-[100dvh] !max-h-[100dvh] !w-screen !max-w-none overflow-y-auto !rounded-none !border-ds-border !bg-ds-bg !text-ds-on-bg sm:!h-[92dvh] sm:!w-[94vw] sm:!max-w-none sm:!rounded-ds">
    <DialogTitle className="!tracking-normal text-ds-primary">{title}</DialogTitle><DialogDescription className="sr-only">Authorized request details, history and actions</DialogDescription>{children}
  </DialogContent></Dialog>;
}
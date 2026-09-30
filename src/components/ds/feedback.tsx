import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, Clock, Inbox, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "info" | "success" | "warning" | "error" | "pending" | "neutral";

const statusStyle: Record<Status, string> = {
  info: "bg-ds-info-soft text-ds-info",
  success: "bg-ds-success-soft text-ds-success",
  warning: "bg-ds-warning-soft text-ds-warning",
  pending: "bg-ds-peach text-ds-warning",
  error: "bg-ds-error-soft text-ds-error",
  neutral: "bg-ds-subtle text-ds-text-2",
};

const statusIcon = { info: Info, success: CheckCircle2, warning: AlertTriangle, pending: Clock, error: XCircle, neutral: Info };

/** Badge: color + icon + text so meaning never depends on color alone. */
export function DsBadge({ status = "neutral", children }: { status?: Status; children: React.ReactNode }) {
  const Icon = statusIcon[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-ds-sm px-2 py-0.5 text-[0.8125rem] font-semibold", statusStyle[status])}>
      <Icon className="size-3.5" aria-hidden /> {children}
    </span>
  );
}

export function DsAlert({
  status = "info",
  title,
  children,
}: {
  status?: Exclude<Status, "pending" | "neutral">;
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = statusIcon[status];
  return (
    <div role={status === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-ds p-4", statusStyle[status])}>
      <Icon className="size-5 mt-0.5 shrink-0" aria-hidden />
      <div>
        <p className="ds-label">{title}</p>
        {children && <div className="ds-body text-ds-on-surface mt-0.5">{children}</div>}
      </div>
    </div>
  );
}

export function DsLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-3 ds-support">
      <span className="size-5 rounded-full border-2 border-ds-border border-t-ds-primary animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </div>
  );
}

export function DsSkeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-ds-sm bg-ds-subtle", className)} aria-hidden />;
}

export function DsEmpty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-10 px-6">
      <Inbox className="size-8 text-ds-text-2" aria-hidden />
      <p className="ds-subheading">{title}</p>
      {children && <p className="ds-support max-w-sm">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function DsModal({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      aria-labelledby="ds-modal-title"
      className="ds-fade-in m-auto w-[min(32rem,calc(100vw-2rem))] rounded-ds bg-ds-surface text-ds-on-surface shadow-ds p-0 backdrop:bg-[rgb(24_32_42/0.45)]"
    >
      <div className="flex items-start justify-between gap-4 p-5 border-b border-ds-border">
        <h2 id="ds-modal-title" className="ds-subheading">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="ds-transition rounded-ds-sm p-1 text-ds-text-2 hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus">
          <X className="size-5" />
        </button>
      </div>
      <div className="p-5 ds-body">{children}</div>
      {footer && <div className="flex justify-end gap-3 p-5 pt-0">{footer}</div>}
    </dialog>
  );
}

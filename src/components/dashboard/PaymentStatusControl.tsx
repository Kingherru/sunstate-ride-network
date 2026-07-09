import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, CircleAlert, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export type PaymentStatus = "not_confirmed" | "pending" | "confirmed" | "refunded";

const META: Record<PaymentStatus, { label: string; icon: any; className: string }> = {
  confirmed: {
    label: "Payment confirmed",
    icon: CheckCircle2,
    className: "bg-emerald-100 text-emerald-800 border-emerald-300",
  },
  pending: {
    label: "Payment pending",
    icon: Clock,
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  not_confirmed: {
    label: "Not confirmed",
    icon: CircleAlert,
    className: "bg-red-100 text-red-800 border-red-300",
  },
  refunded: {
    label: "Refunded",
    icon: RotateCcw,
    className: "bg-slate-100 text-slate-700 border-slate-300",
  },
};

export function PaymentStatusBadge({ status }: { status?: string | null }) {
  const s = ((status ?? "not_confirmed") as PaymentStatus) in META
    ? (status as PaymentStatus)
    : "not_confirmed";
  const m = META[s];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.className}`}
      title={m.label}
    >
      <Icon className="size-3" />
      {m.label}
    </span>
  );
}

/**
 * Payment-status pill that becomes an editable dropdown for the trip's
 * sender / assigned provider / ops staff. Others see a read-only badge.
 */
export function PaymentStatusControl({
  trip,
  canEdit,
  onChanged,
}: {
  trip: { id: string; payment_status?: string | null };
  canEdit: boolean;
  onChanged?: () => void;
}) {
  const current = (trip.payment_status ?? "not_confirmed") as PaymentStatus;
  const [busy, setBusy] = useState(false);

  if (!canEdit) return <PaymentStatusBadge status={current} />;

  async function setStatus(next: PaymentStatus) {
    if (next === current) return;
    setBusy(true);
    try {
      const { error } = await (supabase as any).rpc("set_trip_payment_status", {
        _trip_id: trip.id,
        _status: next,
      });
      if (error) throw error;
      toast.success("Payment status updated");
      onChanged?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not update payment status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <label className="inline-flex items-center gap-2">
      <PaymentStatusBadge status={current} />
      <select
        value={current}
        disabled={busy}
        onChange={(e) => setStatus(e.target.value as PaymentStatus)}
        className="text-[11px] font-semibold bg-background border border-input rounded px-1.5 py-0.5 text-foreground disabled:opacity-60"
        aria-label="Update payment status"
      >
        <option value="not_confirmed">Not confirmed</option>
        <option value="pending">Pending</option>
        <option value="confirmed">Confirmed</option>
        <option value="refunded">Refunded</option>
      </select>
    </label>
  );
}

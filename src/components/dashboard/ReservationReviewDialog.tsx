import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { updateTripStatus } from "@/lib/trips.functions";

type Row = {
  id: string;
  status: string;
  pickup_address: string;
  pickup_address_details?: string | null;
  pickup_city: string | null;
  pickup_zip?: string | null;
  dropoff_address: string;
  dropoff_city: string | null;
  dropoff_zip?: string | null;
  pickup_date: string;
  pickup_time: string;
  appointment_time: string | null;
  return_pickup_time: string | null;
  return_dropoff_time: string | null;
  return_date: string | null;
  round_trip: boolean | null;
  transport_type: string | null;
  patient_first_name: string;
  patient_last_name: string;
  patient_phone?: string | null;
  service_level: string | null;
  needs_wheelchair: boolean | null;
  estimated_cost_cents: number | null;
  distance_miles?: number | null;
  payer: string | null;
  medicaid_number: string | null;
  medicaid_plan: string | null;
  authorization_number?: string | null;
  diagnosis_code?: string | null;
};

function mobilityLabel(r: Row) {
  const t = String(r.transport_type ?? "").toLowerCase();
  if (t === "stretcher" || String(r.service_level ?? "").toLowerCase() === "stretcher") return "Stretcher";
  if (t === "wheelchair" || r.needs_wheelchair) return "Wheelchair";
  return "Ambulatory";
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground break-words mt-0.5">{children ?? "—"}</div>
    </div>
  );
}

export function ReservationReviewDialog({
  row,
  open,
  onOpenChange,
  canApprove,
}: {
  row: Row;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canApprove: boolean;
}) {
  const qc = useQueryClient();
  const update = useServerFn(updateTripStatus);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const isRound = !!row.round_trip;

  async function act(status: "accepted" | "declined") {
    setBusy(status === "accepted" ? "accept" : "decline");
    try {
      await update({ data: { trip_id: row.id, status } });
      toast.success(status === "accepted" ? "Reservation approved" : "Reservation declined");
      qc.invalidateQueries({ queryKey: ["reservations-by-state"] });
      qc.invalidateQueries({ queryKey: ["my-trips"] });
      qc.invalidateQueries({ queryKey: ["unread-counts"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? `Could not ${status === "accepted" ? "approve" : "decline"} reservation`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Reservation Review</DialogTitle>
          <DialogDescription>
            {row.patient_first_name} {row.patient_last_name} · {row.pickup_date}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-2">
          <Field label="Status">{row.status}</Field>
          <Field label="Mobility">{mobilityLabel(row)}</Field>

          <Field label="Pickup address">
            {row.pickup_address}
            <div className="text-xs text-muted-foreground">{[row.pickup_city, row.pickup_zip].filter(Boolean).join(" ")}</div>
          </Field>
          <Field label="Dropoff address">
            {row.dropoff_address}
            <div className="text-xs text-muted-foreground">{[row.dropoff_city, row.dropoff_zip].filter(Boolean).join(" ")}</div>
          </Field>

          <Field label="Pickup time">{row.pickup_time}</Field>
          <Field label="Appointment time">{row.appointment_time}</Field>

          {isRound && (
            <>
              <Field label="Return date">{row.return_date || row.pickup_date}</Field>
              <Field label="Return pickup">{row.return_pickup_time}</Field>
              <Field label="Return drop-off">{row.return_dropoff_time}</Field>
            </>
          )}

          <Field label="Patient phone">{row.patient_phone}</Field>
          <Field label="Payer">{row.payer}</Field>

          {row.medicaid_number && <Field label="Medicaid #">{row.medicaid_number}</Field>}
          {row.medicaid_plan && <Field label="Medicaid plan">{row.medicaid_plan}</Field>}
          {row.authorization_number && <Field label="Authorization #">{row.authorization_number}</Field>}
          {row.diagnosis_code && <Field label="Diagnosis code">{row.diagnosis_code}</Field>}

          <Field label="Estimated price">
            {row.estimated_cost_cents != null ? `$${(row.estimated_cost_cents / 100).toFixed(2)}` : "—"}
          </Field>
          <Field label="Estimated miles">
            {row.distance_miles != null ? `${Number(row.distance_miles).toFixed(1)} mi` : "—"}
          </Field>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm font-bold border border-border px-4 py-2 rounded-sm hover:bg-muted"
          >
            Close
          </button>
          {canApprove && (
            <>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act("declined")}
                className="text-sm font-bold border border-border px-4 py-2 rounded-sm hover:bg-muted disabled:opacity-60"
              >
                {busy === "decline" ? "Declining…" : "Decline"}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act("accepted")}
                className="text-sm font-bold bg-primary text-primary-foreground px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-60"
              >
                {busy === "accept" ? "Approving…" : "Approve reservation"}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

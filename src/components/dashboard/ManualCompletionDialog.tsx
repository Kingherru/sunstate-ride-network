import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { completeTripManually } from "@/lib/duet.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  trip: {
    id: string;
    display_id?: string | null;
    pickup_date: string;
    round_trip?: boolean | null;
    patient_first_name?: string;
    patient_last_name?: string;
  };
  onCompleted?: () => void;
};

function localDateTimeDefault(date: string) {
  // datetime-local wants YYYY-MM-DDTHH:mm
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  return `${d}T08:00`;
}

/**
 * Manual trip close-out: the provider records the real driver times and
 * attests they are accurate. Completion starts the 7-day payout validation
 * window before any funds can be released.
 */
export function ManualCompletionDialog({ open, onOpenChange, trip, onCompleted }: Props) {
  const complete = useServerFn(completeTripManually);
  const [busy, setBusy] = useState(false);
  const [arrived, setArrived] = useState(() => localDateTimeDefault(trip.pickup_date));
  const [pickedUp, setPickedUp] = useState("");
  const [droppedOff, setDroppedOff] = useState("");
  const [returnPickup, setReturnPickup] = useState("");
  const [returnDropoff, setReturnDropoff] = useState("");
  const [notes, setNotes] = useState("");
  const [attested, setAttested] = useState(false);

  const waitMinutes = useMemo(() => {
    if (!arrived || !pickedUp) return null;
    const a = Date.parse(arrived), p = Date.parse(pickedUp);
    if (!Number.isFinite(a) || !Number.isFinite(p) || p < a) return null;
    return Math.round((p - a) / 60000);
  }, [arrived, pickedUp]);

  const canSubmit = !!arrived && !!droppedOff && attested && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    try {
      const res: any = await complete({
        data: {
          trip_id: trip.id,
          driver_arrived_at: new Date(arrived).toISOString(),
          actual_pickup_at: pickedUp ? new Date(pickedUp).toISOString() : null,
          actual_dropoff_at: new Date(droppedOff).toISOString(),
          return_pickup_at: returnPickup ? new Date(returnPickup).toISOString() : null,
          return_dropoff_at: returnDropoff ? new Date(returnDropoff).toISOString() : null,
          wait_minutes: waitMinutes,
          notes: notes.trim() || null,
          attested: true as const,
        },
      });
      if (!res?.ok) {
        toast.error(res?.error ?? "Could not complete this trip");
        return;
      }
      const days = res.validationDays ?? 7;
      toast.success(`Trip completed — payout is pending validation for ${days} days`);
      onOpenChange(false);
      onCompleted?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not complete this trip");
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full text-sm border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30";
  const label = "block text-xs font-bold uppercase tracking-wide text-muted-foreground mb-1";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete trip {trip.display_id ?? ""}</DialogTitle>
          <DialogDescription>
            Enter the actual driver times for{" "}
            {[trip.patient_first_name, trip.patient_last_name].filter(Boolean).join(" ") || "this trip"}.
            These times are used for billing and payout validation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label} htmlFor="mc-arrived">Driver arrival at pickup *</label>
            <input id="mc-arrived" type="datetime-local" className={field} value={arrived}
              onChange={(e) => setArrived(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="mc-pickup">Actual pickup time</label>
            <input id="mc-pickup" type="datetime-local" className={field} value={pickedUp}
              onChange={(e) => setPickedUp(e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="mc-dropoff">Drop-off time *</label>
            <input id="mc-dropoff" type="datetime-local" className={field} value={droppedOff}
              onChange={(e) => setDroppedOff(e.target.value)} />
          </div>
          {trip.round_trip && (
            <>
              <div>
                <label className={label} htmlFor="mc-return-pickup">Return pickup time</label>
                <input id="mc-return-pickup" type="datetime-local" className={field} value={returnPickup}
                  onChange={(e) => setReturnPickup(e.target.value)} />
              </div>
              <div>
                <label className={label} htmlFor="mc-return-dropoff">Return drop-off time</label>
                <input id="mc-return-dropoff" type="datetime-local" className={field} value={returnDropoff}
                  onChange={(e) => setReturnDropoff(e.target.value)} />
              </div>
            </>
          )}
          <div className="sm:col-span-2">
            <label className={label} htmlFor="mc-notes">Completion notes</label>
            <textarea id="mc-notes" rows={2} className={field} value={notes}
              onChange={(e) => setNotes(e.target.value)} placeholder="Optional — anything dispatch should know" />
          </div>
        </div>

        {waitMinutes != null && (
          <p className="text-xs text-muted-foreground">
            Calculated wait time: <span className="font-bold text-foreground">{waitMinutes} min</span>
          </p>
        )}

        <label className="flex items-start gap-2 text-sm border border-border rounded-sm p-3 bg-muted/40">
          <input type="checkbox" className="mt-0.5" checked={attested}
            onChange={(e) => setAttested(e.target.checked)} />
          <span>
            I confirm the information submitted is accurate and reflects the actual service provided.
          </span>
        </label>

        <p className="text-xs text-muted-foreground">
          Completed trips remain <strong>pending validation for 7 days</strong> before payout is released.
        </p>

        <DialogFooter className="gap-2">
          <button type="button" onClick={() => onOpenChange(false)}
            className="text-sm font-bold border border-border px-4 py-2 rounded-sm hover:bg-muted">
            Cancel
          </button>
          <button type="button" disabled={!canSubmit} onClick={submit}
            className="text-sm font-bold text-white bg-emerald-600 border border-emerald-700 px-4 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "Completing…" : "Complete trip"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

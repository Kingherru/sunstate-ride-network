import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listTripDispatchEvents, syncTripToDuet, pullTripFromDuet } from "@/lib/duet.functions";
import { formatIsoDateTime12 } from "@/lib/time-format";

type Props = { tripId: string; canSync?: boolean };

const LABELS: Record<string, string> = {
  "sync.push.ok": "Sent to Duet",
  "sync.push.error": "Send to Duet failed",
  "sync.pull.ok": "Snapshot pulled from Duet",
  "sync.pull.error": "Pull from Duet failed",
  rideScheduled: "Ride scheduled",
  rideUnscheduled: "Ride unscheduled",
  willCallInitiated: "Will-call initiated",
  onTheWay: "Driver on the way",
  pickupArrived: "Driver arrived at pickup",
  pickupCompleted: "Patient picked up",
  dropoffArrived: "Arrived at drop-off",
  dropoffCompleted: "Drop-off completed",
  rideCanceled: "Ride canceled",
  rideRejected: "Ride rejected",
  noShow: "No-show",
  gpsEvent: "GPS ping",
};

function kind(eventType: string): "sent" | "error" | "received" {
  if (eventType.endsWith(".error")) return "error";
  if (eventType.startsWith("sync.")) return "sent";
  return "received";
}

const KIND_STYLES: Record<string, string> = {
  sent: "bg-primary/10 text-primary border-primary/30",
  received: "bg-emerald-100 text-emerald-900 border-emerald-300",
  error: "bg-red-100 text-red-900 border-red-300",
};

export function TripSyncTimeline({ tripId, canSync = true }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [openRow, setOpenRow] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["trip-dispatch-events", tripId],
    queryFn: () => listTripDispatchEvents({ data: { trip_id: tripId } }),
  });

  const trip = q.data?.trip as any;
  const events = q.data?.events ?? [];

  async function run(action: "push" | "pull") {
    setBusy(action);
    try {
      const res: any = action === "push"
        ? await syncTripToDuet({ data: { trip_id: tripId } })
        : await pullTripFromDuet({ data: { trip_id: tripId } });
      if (res?.ok) toast.success(action === "push" ? "Trip sent to Duet" : "Latest Duet status pulled");
      else toast.error(res?.error ?? "Duet request failed");
    } catch (e: any) {
      toast.error(e?.message ?? "Duet request failed");
    } finally {
      setBusy(null);
      qc.invalidateQueries({ queryKey: ["trip-dispatch-events", tripId] });
    }
  }

  return (
    <section className="border border-border rounded-sm p-4 bg-muted/30 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide">Dispatch sync timeline</h3>
          <p className="text-xs text-muted-foreground">
            {trip?.duet_ride_id
              ? <>Duet ride <span className="font-mono">{trip.duet_ride_id}</span>
                  {trip.duet_synced_at ? ` · last sent ${formatIsoDateTime12(trip.duet_synced_at)}` : ""}
                  {trip.duet_last_event ? ` · last update ${LABELS[trip.duet_last_event] ?? trip.duet_last_event}` : ""}</>
              : "This trip has not been sent to dispatch software yet."}
          </p>
        </div>
        {canSync && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => run("push")}
              className="text-xs font-bold border border-border px-3 py-1.5 rounded-sm hover:bg-muted disabled:opacity-60"
            >
              {busy === "push" ? "Sending…" : trip?.duet_ride_id ? "Re-send to Duet" : "Send to Duet"}
            </button>
            <button
              type="button"
              disabled={!!busy || !trip?.duet_ride_id}
              onClick={() => run("pull")}
              className="text-xs font-bold border border-border px-3 py-1.5 rounded-sm hover:bg-muted disabled:opacity-60"
            >
              {busy === "pull" ? "Refreshing…" : "Refresh status"}
            </button>
          </div>
        )}
      </div>

      {q.isLoading ? (
        <p className="text-xs text-muted-foreground">Loading timeline…</p>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No dispatch activity recorded for this trip yet.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((e: any) => {
            const k = kind(e.event_type);
            const err = (e.payload as any)?.error;
            return (
              <li key={e.id} className="border border-border rounded-sm bg-background px-3 py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className={`inline-flex items-center border text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm ${KIND_STYLES[k]}`}>
                    {k === "sent" ? "Sent" : k === "error" ? "Error" : "Received"}
                  </span>
                  <span className="text-xs font-bold">{LABELS[e.event_type] ?? e.event_type}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatIsoDateTime12(e.event_time ?? e.created_at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpenRow(openRow === e.id ? null : e.id)}
                    className="ml-auto text-[11px] font-bold text-primary hover:underline"
                  >
                    {openRow === e.id ? "Hide details" : "Details"}
                  </button>
                </div>
                {err && <p className="text-xs text-red-700 mt-1 break-words">{String(err)}</p>}
                {e.latitude != null && e.longitude != null && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    GPS {Number(e.latitude).toFixed(5)}, {Number(e.longitude).toFixed(5)}
                  </p>
                )}
                {openRow === e.id && (
                  <pre className="mt-2 text-[10px] leading-snug bg-muted/60 border border-border rounded-sm p-2 overflow-x-auto max-h-56">
                    {JSON.stringify(e.payload ?? {}, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

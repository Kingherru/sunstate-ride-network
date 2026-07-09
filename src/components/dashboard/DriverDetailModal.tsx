import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Mail, Calendar } from "lucide-react";
import { emailDriverWeeklySchedule, listDriverUpcomingTrips } from "@/lib/schedule-board.functions";

export function DriverDetailModal({
  driverId,
  onClose,
}: {
  driverId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listDriverUpcomingTrips);
  const emailFn = useServerFn(emailDriverWeeklySchedule);

  const q = useQuery({
    queryKey: ["driver-upcoming-trips", driverId],
    queryFn: () => listFn({ data: { driver_id: driverId, days: 7 } }),
  });

  const m = useMutation({
    mutationFn: () => emailFn({ data: { driver_id: driverId } }),
    onSuccess: (r: any) => {
      toast.success(`Weekly schedule sent to ${r.recipient} (${r.trip_count} trip${r.trip_count === 1 ? "" : "s"})`);
      qc.invalidateQueries({ queryKey: ["driver-upcoming-trips", driverId] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  const driver = q.data?.driver;
  const trips = q.data?.trips ?? [];

  // Group trips by date
  const grouped: Record<string, any[]> = {};
  for (const t of trips) {
    (grouped[t.pickup_date] ??= []).push(t);
  }
  const dates = Object.keys(grouped).sort();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-md shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight">
              {driver ? `${driver.first_name ?? ""} ${driver.last_name ?? ""}`.trim() : "Driver"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {driver?.email ? (
                <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{driver.email}</span>
              ) : (
                <span className="text-destructive">No email on file — add one in Fleet to send schedules</span>
              )}
              {driver?.phone && <span className="ml-3">{driver.phone}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-bold">Next 7 days</span>
              <span className="text-muted-foreground">· {trips.length} trip{trips.length === 1 ? "" : "s"}</span>
            </div>
            <button
              onClick={() => m.mutate()}
              disabled={m.isPending || !driver?.email}
              className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50 text-sm"
            >
              {m.isPending ? "Sending…" : "Email weekly schedule"}
            </button>
          </div>

          {q.isLoading && <p className="text-sm text-muted-foreground">Loading trips…</p>}

          {!q.isLoading && trips.length === 0 && (
            <p className="text-sm text-muted-foreground bg-muted/40 border border-border rounded-sm p-4">
              No trips assigned to this driver in the next 7 days.
            </p>
          )}

          {dates.map((date) => (
            <div key={date}>
              <div className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground mb-2">
                {new Date(date + "T00:00:00").toLocaleDateString(undefined, {
                  weekday: "long", month: "short", day: "numeric",
                })}
              </div>
              <ul className="space-y-2">
                {grouped[date].map((t) => {
                  const time = ((t.scheduled_start_time ?? t.pickup_time) ?? "").toString().slice(0, 5);
                  return (
                    <li key={t.id} className="border border-border rounded-sm p-3 bg-card text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-bold">{time} · {t.patient_first_name} {t.patient_last_name}</span>
                        {t.status && (
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-sm bg-accent/15 text-accent">
                            {t.status}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {t.pickup_city} → {t.dropoff_city}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

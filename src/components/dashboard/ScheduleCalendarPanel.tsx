import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DriverDetailModal } from "./DriverDetailModal";

export const RESV_DND_MIME = "application/x-reservation-id";
import {
  getMyWorkHours,
  listMyDrivers,
  listReservationsForDay,
  assignDriverSlot,
} from "@/lib/schedule-board.functions";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(iso: string, delta: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}
function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric", year: "numeric",
  });
}
function hoursBetween(start: string, end: string): string[] {
  const [sh] = start.split(":").map(Number);
  const [eh] = end.split(":").map(Number);
  const out: string[] = [];
  for (let h = sh; h <= eh; h++) out.push(`${String(h).padStart(2, "0")}:00`);
  return out;
}
function fmt12h(hhmm: string) {
  const h = Number(hhmm.slice(0, 2));
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh} ${suffix}`;
}
function fmtTime12(t: string | null | undefined) {
  if (!t) return "";
  const [hs, ms] = t.toString().split(":");
  const h = Number(hs);
  const m = Number(ms ?? 0);
  const suffix = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${suffix}`;
}

const UNASSIGNED = "__unassigned__";

export function ScheduleCalendarPanel() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(todayISO());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hideEmptyDrivers, setHideEmptyDrivers] = useState(false);
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);

  const whFn = useServerFn(getMyWorkHours);
  const driversFn = useServerFn(listMyDrivers);
  const resvFn = useServerFn(listReservationsForDay);
  const assignFn = useServerFn(assignDriverSlot);

  const whQ = useQuery({ queryKey: ["work-hours"], queryFn: () => whFn() });
  const driversQ = useQuery({ queryKey: ["my-drivers"], queryFn: () => driversFn() });
  const resvQ = useQuery({
    queryKey: ["day-reservations", date],
    queryFn: () => resvFn({ data: { date } }),
  });

  const mAssign = useMutation({
    mutationFn: (v: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) =>
      assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Schedule saved — driver notified");
      qc.invalidateQueries({ queryKey: ["day-reservations"] });
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dow = String(new Date(date + "T00:00:00").getDay()) as "0"|"1"|"2"|"3"|"4"|"5"|"6";
  const dayCfg = whQ.data?.weekly?.[dow];
  const closed = !!dayCfg?.closed;
  const workStart = (dayCfg?.start ?? "06:00").slice(0, 5);
  const workEnd = (dayCfg?.end ?? "20:00").slice(0, 5);
  const workStartH = Number(workStart.slice(0, 2));
  const workEndH = Number(workEnd.slice(0, 2));
  const allDrivers = driversQ.data ?? [];
  const allReservations = resvQ.data ?? [];

  const statusOptions = useMemo(
    () => Array.from(new Set(allReservations.map((r: any) => r.status).filter(Boolean))) as string[],
    [allReservations],
  );

  const reservations = useMemo(
    () => allReservations.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (driverFilter === "unassigned" && r.assigned_driver_id) return false;
      if (driverFilter !== "all" && driverFilter !== "unassigned" && r.assigned_driver_id !== driverFilter) return false;
      return true;
    }),
    [allReservations, statusFilter, driverFilter],
  );

  const drivers = useMemo(() => {
    let list = allDrivers;
    if (driverFilter !== "all" && driverFilter !== "unassigned") {
      list = list.filter((d: any) => d.id === driverFilter);
    }
    if (hideEmptyDrivers) {
      const active = new Set(reservations.map((r: any) => r.assigned_driver_id).filter(Boolean));
      list = list.filter((d: any) => active.has(d.id));
    }
    return list;
  }, [allDrivers, driverFilter, hideEmptyDrivers, reservations]);

  // Hour columns: work-hour range, extended to include any reservation times that fall outside.
  const hours = useMemo(() => {
    if (closed && reservations.length === 0) return [];
    let minH = closed ? Infinity : workStartH;
    let maxH = closed ? -Infinity : workEndH;
    reservations.forEach((r: any) => {
      const t = (r.scheduled_start_time ?? r.pickup_time ?? "").toString();
      const hh = Number(t.slice(0, 2));
      if (!Number.isNaN(hh)) {
        if (hh < minH) minH = hh;
        if (hh > maxH) maxH = hh;
      }
    });
    if (!isFinite(minH)) return [];
    return hoursBetween(`${String(minH).padStart(2, "0")}:00`, `${String(maxH).padStart(2, "0")}:00`);
  }, [closed, workStartH, workEndH, reservations]);

  const cellMap = useMemo(() => {
    const m = new Map<string, any[]>();
    reservations.forEach((r: any) => {
      const t = (r.scheduled_start_time ?? r.pickup_time ?? "00:00").slice(0, 2);
      const key = `${r.assigned_driver_id ?? UNASSIGNED}__${t}:00`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return m;
  }, [reservations]);

  const unassigned = reservations.filter((r: any) => !r.assigned_driver_id);

  function isAfterHours(hhmm: string) {
    const h = Number(hhmm.slice(0, 2));
    return closed || h < workStartH || h >= workEndH;
  }

  function driverDayCfg(d: any) {
    const a = d?.availability;
    if (!a || typeof a !== "object") return { mode: "flexible" as const };
    if (a.mode === "flexible") return { mode: "flexible" as const };
    return { mode: "weekly" as const, day: a.days?.[dow] };
  }
  function driverAvailLabel(d: any) {
    const cfg = driverDayCfg(d);
    if (cfg.mode === "flexible") return "Flexible";
    if (!cfg.day || cfg.day.off) return "Off today";
    return `${(cfg.day.start ?? "09:00").slice(0,5)}–${(cfg.day.end ?? "17:00").slice(0,5)}`;
  }
  function isDriverUnavailable(d: any, hhmm: string) {
    const cfg = driverDayCfg(d);
    if (cfg.mode === "flexible") return false;
    if (!cfg.day || cfg.day.off) return true;
    const h = Number(hhmm.slice(0, 2));
    const sh = Number((cfg.day.start ?? "09:00").slice(0, 2));
    const eh = Number((cfg.day.end ?? "17:00").slice(0, 2));
    return h < sh || h >= eh;
  }

  function onDrop(e: React.DragEvent, driverId: string | null, hour: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData(RESV_DND_MIME) || draggingId;
    if (!id) return;
    mAssign.mutate({
      reservation_id: id,
      driver_id: driverId,
      scheduled_start_time: hour,
    });
    setDraggingId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Schedule board</h2>
        <p className="text-sm text-muted-foreground">
          Drag a reservation into a driver column at the right time to schedule or reschedule it. The driver is notified automatically.
          Times outside your posted work hours are shaded so after-hours trips stand out.
        </p>
      </div>

      {/* Date navigator */}
      <div className="flex items-center justify-center gap-4 bg-card border border-border rounded-2xl py-3 px-4">
        <button
          onClick={() => setDate(addDays(date, -1))}
          className="rounded-sm border border-border px-3 py-2 hover:bg-muted"
          aria-label="Previous day"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Viewing schedule for</div>
          <div className="text-lg font-extrabold">{fmtDate(date)}</div>
          <button
            onClick={() => setDate(todayISO())}
            className="text-xs font-bold text-primary hover:underline mt-1"
          >
            Jump to today
          </button>
        </div>
        <button
          onClick={() => setDate(addDays(date, 1))}
          className="rounded-sm border border-border px-3 py-2 hover:bg-muted"
          aria-label="Next day"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="text-xs font-bold uppercase tracking-wider bg-card border border-border rounded-sm px-3 py-2"
          aria-label="Filter drivers on board"
        >
          <option value="all">All drivers</option>
          <option value="unassigned">Unassigned only</option>
          {allDrivers.map((d: any) => (
            <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-bold uppercase tracking-wider bg-card border border-border rounded-sm px-3 py-2"
          aria-label="Filter reservations on board by status"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-card border border-border rounded-sm px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hideEmptyDrivers}
            onChange={(e) => setHideEmptyDrivers(e.target.checked)}
          />
          Hide drivers with no trips
        </label>
        <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground ml-auto">
          {reservations.length} of {allReservations.length} trips · {drivers.length} of {allDrivers.length} drivers
        </div>
      </div>

      {closed && (
        <div className="bg-accent/15 border border-accent/40 text-foreground rounded-2xl p-4 text-sm">
          <span className="font-bold uppercase tracking-wider text-xs mr-2">Closed</span>
          Your account marks this day of the week as closed. Any trips on this day are shown as after-hours.
          Edit your weekly work hours on the Account page to open it.
        </div>
      )}

      {/* Dispatch summary */}
      {drivers.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground">
              Dispatch summary · Live
            </div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              {reservations.filter((r: any) => r.assigned_driver_id).length} assigned · {unassigned.length} unassigned
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {drivers.map((d: any) => {
              const dTrips = reservations
                .filter((r: any) => r.assigned_driver_id === d.id)
                .sort((a: any, b: any) =>
                  ((a.scheduled_start_time ?? a.pickup_time ?? "") + "")
                    .localeCompare((b.scheduled_start_time ?? b.pickup_time ?? "") + ""),
                );
              const next = dTrips[0];
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setOpenDriverId(d.id)}
                  className="text-left rounded-sm border border-border bg-background hover:border-accent hover:shadow-sm transition p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm truncate">{d.first_name} {d.last_name}</span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm ${
                      dTrips.length === 0
                        ? "bg-slate-100 text-slate-600"
                        : "bg-emerald-100 text-emerald-800"
                    }`}>
                      {dTrips.length} trip{dTrips.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  {next ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      <span className="font-mono">
                        {fmtTime12((next.scheduled_start_time ?? next.pickup_time ?? "").toString().slice(0, 5))}
                      </span>{" "}
                      · {next.patient_first_name} {next.patient_last_name}
                      <div className="truncate">{next.pickup_city} → {next.dropoff_city}</div>
                    </div>
                  ) : (
                    <div className="mt-1 text-[11px] text-muted-foreground italic">No trips scheduled</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unassigned bin */}
      <div
        className="bg-card border border-dashed border-border rounded-2xl p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => onDrop(e, null, hours[0] ?? "00:00")}
      >
        <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
          Unassigned ({unassigned.length}) — drop here to unschedule
        </div>
        {unassigned.length === 0 ? (
          <div className="text-xs text-muted-foreground">All reservations assigned.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassigned.map((r: any) => (
              <ReservationChip key={r.id} r={r} onDragStart={setDraggingId} dragging={draggingId === r.id} />
            ))}
          </div>
        )}
      </div>

      {/* Calendar grid — time on Y, drivers on X */}
      <div className="bg-card border border-border rounded-2xl overflow-auto">
        {driversQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading drivers…</div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Add drivers in your Fleet panel first to schedule them.
          </div>
        ) : hours.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No work hours configured for this day and no trips scheduled.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead className="bg-background/60">
              <tr>
                <th className="sticky left-0 z-10 bg-background/80 border-r border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-bold px-3 py-2 w-44">
                  Time
                </th>
                {drivers.map((d: any) => {
                  const dTripCount = reservations.filter((r: any) => r.assigned_driver_id === d.id).length;
                  return (
                    <th
                      key={d.id}
                      className="border-r border-border text-left px-3 py-2 min-w-44"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenDriverId(d.id)}
                        className="text-left text-xs font-bold hover:text-accent hover:underline decoration-dotted underline-offset-2"
                        title="View schedule & email driver"
                      >
                        {d.first_name} {d.last_name}
                      </button>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {d.status} · {dTripCount} trip{dTripCount === 1 ? "" : "s"}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => {
                const after = isAfterHours(h);
                return (
                  <tr key={h} className="border-t border-border">
                    <td
                      className={`sticky left-0 z-10 border-r border-border px-3 py-2 font-bold whitespace-nowrap ${after ? "bg-accent/15" : "bg-card"}`}
                      title={after ? "Outside posted work hours" : undefined}
                    >
                      <span className="font-mono text-xs text-primary">{fmt12h(h)}</span>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {after ? "After hours" : "Work hours"}
                      </div>
                    </td>
                    {drivers.map((d: any) => {
                      const key = `${d.id}__${h}`;
                      const cell = cellMap.get(key) ?? [];
                      return (
                        <td
                          key={d.id}
                          className={`border-r border-border align-top p-1 min-h-[60px] ${after ? "bg-accent/15" : "hover:bg-primary/5"}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, d.id, h)}
                          title={after ? "Outside posted work hours" : undefined}
                        >
                          <div className="space-y-1 min-h-[54px]">
                            {cell.map((r: any) => (
                              <ReservationChip key={r.id} r={r} onDragStart={setDraggingId} dragging={draggingId === r.id} small />
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openDriverId && (
        <DriverDetailModal driverId={openDriverId} onClose={() => setOpenDriverId(null)} />
      )}
    </div>
  );
}

function ReservationChip({
  r, onDragStart, dragging, small = false,
}: {
  r: any;
  onDragStart: (id: string) => void;
  dragging: boolean;
  small?: boolean;
}) {
  const t = (r.scheduled_start_time ?? r.pickup_time ?? "").toString().slice(0, 5);
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData(RESV_DND_MIME, r.id); e.dataTransfer.effectAllowed = "move"; onDragStart(r.id); }}
      className={`cursor-grab active:cursor-grabbing rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-xs ${dragging ? "opacity-50" : ""}`}
      title={`${r.patient_first_name} ${r.patient_last_name}\n${r.pickup_address} → ${r.dropoff_address}`}
    >
      <div className="font-bold">
        {fmtTime12(t)} · {r.patient_first_name} {r.patient_last_name}
      </div>
      {!small && (
        <div className="text-[10px] text-muted-foreground">
          {r.pickup_city} → {r.dropoff_city}
        </div>
      )}
    </div>
  );
}

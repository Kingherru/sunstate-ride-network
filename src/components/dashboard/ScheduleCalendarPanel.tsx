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
  listReservationsForWeek,
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
function mondayOf(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const day = (d.getDay() + 6) % 7; // Monday=0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}
function fmtWeekRange(weekStart: string) {
  const s = new Date(weekStart + "T00:00:00");
  const e = new Date(s); e.setDate(e.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, { ...opts, year: "numeric" })}`;
}
function hourRange(startH: number, endH: number): number[] {
  const out: number[] = [];
  for (let h = startH; h <= endH; h++) out.push(h);
  return out;
}
function fmt12(h: number) {
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
// Monday-first day-of-week array with weekday index (0=Sun..6=Sat) for work_hours lookup
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_DOW = [1, 2, 3, 4, 5, 6, 0] as const;

export function ScheduleCalendarPanel() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string>(mondayOf(todayISO()));
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [hideEmptyDrivers, setHideEmptyDrivers] = useState(false);
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);

  const whFn = useServerFn(getMyWorkHours);
  const driversFn = useServerFn(listMyDrivers);
  const weekFn = useServerFn(listReservationsForWeek);
  const assignFn = useServerFn(assignDriverSlot);

  const whQ = useQuery({ queryKey: ["work-hours"], queryFn: () => whFn() });
  const driversQ = useQuery({ queryKey: ["my-drivers"], queryFn: () => driversFn() });
  const resvQ = useQuery({
    queryKey: ["week-reservations", weekStart],
    queryFn: () => weekFn({ data: { week_start: weekStart } }),
  });

  const mAssign = useMutation({
    mutationFn: (v: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) =>
      assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Schedule saved — driver notified");
      qc.invalidateQueries({ queryKey: ["week-reservations"] });
      qc.invalidateQueries({ queryKey: ["my-reservations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const weekly = whQ.data?.weekly;
  const allDrivers = driversQ.data ?? [];
  const allReservations = resvQ.data ?? [];

  // Build day list (7 iso dates, Mon..Sun)
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => ({
      iso: addDays(weekStart, i),
      label: DAY_LABELS[i],
      dow: DAY_DOW[i] as 0|1|2|3|4|5|6,
    })),
    [weekStart],
  );

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

  // Hours displayed on the X-axis: union of all open days' work-hour spans
  // (falls back to 6 AM–8 PM if the provider has no open days this week).
  const { hours, dayBounds } = useMemo(() => {
    const bounds = new Map<string, { start: number; end: number; closed: boolean }>();
    let minH = Infinity, maxH = -Infinity;
    for (const d of days) {
      const cfg = weekly?.[String(d.dow) as "0"|"1"|"2"|"3"|"4"|"5"|"6"];
      const closed = !!cfg?.closed;
      const sh = Number((cfg?.start ?? "06:00").slice(0, 2));
      const eh = Number((cfg?.end ?? "20:00").slice(0, 2));
      bounds.set(d.iso, { start: sh, end: eh, closed });
      if (!closed) {
        if (sh < minH) minH = sh;
        if (eh > maxH) maxH = eh;
      }
    }
    if (!isFinite(minH)) { minH = 6; maxH = 20; }
    return { hours: hourRange(minH, maxH), dayBounds: bounds };
  }, [days, weekly]);

  // Cell lookup: `${iso}__${hour}` -> reservations
  const cellMap = useMemo(() => {
    const m = new Map<string, any[]>();
    reservations.forEach((r: any) => {
      const t = (r.scheduled_start_time ?? r.pickup_time ?? "00:00").toString();
      const hh = Number(t.slice(0, 2));
      const key = `${r.pickup_date}__${hh}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(r);
    });
    return m;
  }, [reservations]);

  const unassigned = reservations.filter((r: any) => !r.assigned_driver_id);
  const todayIso = todayISO();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Schedule board</h2>
        <p className="text-sm text-muted-foreground">
          Weekly view — days run down the side, work-hour times run across the top.
          After-hours cells are shaded so you can spot trips outside your posted hours.
          Update your weekly work hours on the Account page.
        </p>
      </div>

      {/* Week navigator */}
      <div className="flex items-center justify-center gap-4 bg-card border border-border rounded-2xl py-3 px-4">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="rounded-sm border border-border px-3 py-2 hover:bg-muted"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Week of</div>
          <div className="text-lg font-extrabold">{fmtWeekRange(weekStart)}</div>
          <button
            onClick={() => setWeekStart(mondayOf(todayISO()))}
            className="text-xs font-bold text-primary hover:underline mt-1"
          >
            Jump to this week
          </button>
        </div>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="rounded-sm border border-border px-3 py-2 hover:bg-muted"
          aria-label="Next week"
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

      {/* Top summary — live driver → trip assignments */}
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
                  ((a.pickup_date ?? "") + (a.scheduled_start_time ?? a.pickup_time ?? ""))
                    .localeCompare((b.pickup_date ?? "") + (b.scheduled_start_time ?? b.pickup_time ?? "")),
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
      <div className="bg-card border border-dashed border-border rounded-2xl p-4">
        <div className="text-xs uppercase tracking-wider font-bold text-muted-foreground mb-2">
          Unassigned ({unassigned.length})
        </div>
        {unassigned.length === 0 ? (
          <div className="text-xs text-muted-foreground">All reservations assigned.</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {unassigned.map((r: any) => (
              <ReservationChip key={r.id} r={r} />
            ))}
          </div>
        )}
      </div>

      {/* Weekly calendar — days × hours */}
      <div className="hidden lg:block bg-card border border-border rounded-2xl overflow-auto">
        <table className="w-full text-sm border-collapse min-w-[900px]">
          <thead className="bg-background/60">
            <tr>
              <th className="sticky left-0 z-10 bg-background/80 border-r border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-bold px-3 py-2 w-40">
                Day
              </th>
              {hours.map((h) => (
                <th key={h} className="border-r border-border text-xs font-bold text-muted-foreground px-2 py-2 w-24">
                  {fmt12(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const b = dayBounds.get(d.iso)!;
              const isToday = d.iso === todayIso;
              const dayLabel = new Date(d.iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
              return (
                <tr key={d.iso} className="border-t border-border">
                  <td className={`sticky left-0 z-10 bg-card border-r border-border px-3 py-2 font-bold whitespace-nowrap ${isToday ? "text-primary" : ""}`}>
                    <div>{d.label}</div>
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      {dayLabel}{isToday ? " · Today" : ""}{b.closed ? " · Closed" : ""}
                    </div>
                  </td>
                  {hours.map((h) => {
                    const key = `${d.iso}__${h}`;
                    const cell = cellMap.get(key) ?? [];
                    const afterHours = b.closed || h < b.start || h >= b.end;
                    return (
                      <td
                        key={h}
                        className={`border-r border-border align-top p-1 min-h-[56px] ${afterHours ? "bg-accent/15" : "hover:bg-primary/5"}`}
                        title={afterHours ? "Outside posted work hours" : undefined}
                      >
                        <div className="space-y-1 min-h-[54px]">
                          {cell.map((r: any) => (
                            <ReservationChip key={r.id} r={r} small />
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
      </div>

      {/* Mobile / tablet — per-day cards */}
      <div className="lg:hidden space-y-3">
        {days.map((d) => {
          const b = dayBounds.get(d.iso)!;
          const dayTrips = reservations
            .filter((r: any) => r.pickup_date === d.iso)
            .sort((a: any, b2: any) =>
              ((a.scheduled_start_time ?? a.pickup_time ?? "") + "")
                .localeCompare((b2.scheduled_start_time ?? b2.pickup_time ?? "") + ""),
            );
          const dayLabel = new Date(d.iso + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
          return (
            <div key={d.iso} className={`bg-card border border-border rounded-2xl overflow-hidden ${b.closed ? "bg-accent/10" : ""}`}>
              <div className="px-4 py-3 bg-background/60 flex items-center justify-between">
                <div>
                  <div className="font-bold">{dayLabel}</div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    {b.closed ? "Closed" : `${fmt12(b.start)} – ${fmt12(b.end)}`}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-sm bg-slate-100 text-slate-700">
                  {dayTrips.length} trip{dayTrips.length === 1 ? "" : "s"}
                </span>
              </div>
              {dayTrips.length > 0 && (
                <ul className="divide-y divide-border">
                  {dayTrips.map((r: any) => {
                    const t = (r.scheduled_start_time ?? r.pickup_time ?? "").toString().slice(0, 5);
                    const hh = Number(t.slice(0, 2));
                    const afterHours = b.closed || hh < b.start || hh >= b.end;
                    return (
                      <li key={r.id} className={`px-4 py-2 flex items-start gap-3 ${afterHours ? "bg-accent/15" : ""}`}>
                        <span className="font-mono text-xs font-bold text-primary shrink-0 pt-0.5 w-20">
                          {fmtTime12(t)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold truncate">
                            {r.patient_first_name} {r.patient_last_name}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {r.pickup_city} → {r.dropoff_city}
                          </div>
                        </div>
                        <select
                          value={r.assigned_driver_id ?? ""}
                          onChange={(e) =>
                            mAssign.mutate({
                              reservation_id: r.id,
                              driver_id: e.target.value || null,
                              scheduled_start_time: t,
                            })
                          }
                          className="text-[11px] bg-background border border-input rounded px-1.5 py-1"
                          aria-label="Reassign driver"
                        >
                          <option value="">Unassign</option>
                          {allDrivers.map((dd: any) => (
                            <option key={dd.id} value={dd.id}>{dd.first_name} {dd.last_name}</option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {openDriverId && (
        <DriverDetailModal driverId={openDriverId} onClose={() => setOpenDriverId(null)} />
      )}
    </div>
  );
}

function ReservationChip({ r, small = false }: { r: any; small?: boolean }) {
  const t = (r.scheduled_start_time ?? r.pickup_time ?? "").toString().slice(0, 5);
  return (
    <div
      className="rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-xs"
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

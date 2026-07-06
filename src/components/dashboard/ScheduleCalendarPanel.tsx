import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  getMyWorkHours,
  saveMyWorkHours,
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
  for (let h = sh; h <= eh; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out;
}

const UNASSIGNED = "__unassigned__";

export function ScheduleCalendarPanel() {
  const qc = useQueryClient();
  const [date, setDate] = useState<string>(todayISO());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const whFn = useServerFn(getMyWorkHours);
  const saveWhFn = useServerFn(saveMyWorkHours);
  const driversFn = useServerFn(listMyDrivers);
  const resvFn = useServerFn(listReservationsForDay);
  const assignFn = useServerFn(assignDriverSlot);

  const whQ = useQuery({ queryKey: ["work-hours"], queryFn: () => whFn() });
  const driversQ = useQuery({ queryKey: ["my-drivers"], queryFn: () => driversFn() });
  const resvQ = useQuery({
    queryKey: ["day-reservations", date],
    queryFn: () => resvFn({ data: { date } }),
  });

  const mSaveWh = useMutation({
    mutationFn: (v: { start: string; end: string }) => saveWhFn({ data: v }),
    onSuccess: () => { toast.success("Work hours saved"); qc.invalidateQueries({ queryKey: ["work-hours"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const mAssign = useMutation({
    mutationFn: (v: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) =>
      assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Schedule saved — driver notified");
      qc.invalidateQueries({ queryKey: ["day-reservations"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const start = whQ.data?.start?.slice(0, 5) ?? "06:00";
  const end = whQ.data?.end?.slice(0, 5) ?? "20:00";
  const hours = useMemo(() => hoursBetween(start, end), [start, end]);
  const drivers = driversQ.data ?? [];
  const reservations = resvQ.data ?? [];

  // Bucketed map: `${driverId|__unassigned__}__${HH}` -> reservations[]
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

  function onDrop(driverId: string | null, hour: string) {
    if (!draggingId) return;
    mAssign.mutate({
      reservation_id: draggingId,
      driver_id: driverId,
      scheduled_start_time: hour,
    });
    setDraggingId(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Drag a reservation onto a driver + time slot. Save automatically notifies the driver.
          </p>
        </div>
        <WorkHoursEditor
          start={start}
          end={end}
          onSave={(s, e) => mSaveWh.mutate({ start: s, end: e })}
          saving={mSaveWh.isPending}
        />
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

      {/* Unassigned bin */}
      <div
        className="bg-card border border-dashed border-border rounded-2xl p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => onDrop(null, hours[0] ?? "00:00")}
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

      {/* Calendar grid */}
      <div className="bg-card border border-border rounded-2xl overflow-auto">
        {driversQ.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading drivers…</div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Add drivers in your Fleet panel first to schedule them.
          </div>
        ) : (
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead className="bg-background/60">
              <tr>
                <th className="sticky left-0 z-10 bg-background/80 border-r border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-bold px-3 py-2 w-40">
                  Driver
                </th>
                {hours.map((h) => (
                  <th key={h} className="border-r border-border text-xs font-bold text-muted-foreground px-2 py-2 w-32">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {drivers.map((d: any) => (
                <tr key={d.id} className="border-t border-border">
                  <td className="sticky left-0 z-10 bg-card border-r border-border px-3 py-2 font-bold whitespace-nowrap">
                    {d.first_name} {d.last_name}
                    <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{d.status}</div>
                  </td>
                  {hours.map((h) => {
                    const key = `${d.id}__${h}`;
                    const cell = cellMap.get(key) ?? [];
                    return (
                      <td
                        key={h}
                        className="border-r border-border align-top p-1 min-h-[60px] hover:bg-primary/5"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => onDrop(d.id, h)}
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
              ))}
            </tbody>
          </table>
        )}
      </div>
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
  return (
    <div
      draggable
      onDragStart={() => onDragStart(r.id)}
      className={`cursor-grab active:cursor-grabbing rounded-sm border border-primary/30 bg-primary/10 px-2 py-1 text-xs ${dragging ? "opacity-50" : ""}`}
      title={`${r.patient_first_name} ${r.patient_last_name}\n${r.pickup_address} → ${r.dropoff_address}`}
    >
      <div className="font-bold">
        {(r.scheduled_start_time ?? r.pickup_time ?? "").toString().slice(0, 5)} · {r.patient_first_name} {r.patient_last_name}
      </div>
      {!small && (
        <div className="text-[10px] text-muted-foreground">
          {r.pickup_city} → {r.dropoff_city}
        </div>
      )}
    </div>
  );
}

function WorkHoursEditor({
  start, end, onSave, saving,
}: {
  start: string; end: string;
  onSave: (start: string, end: string) => void;
  saving: boolean;
}) {
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  return (
    <div className="flex items-end gap-2 bg-card border border-border rounded-sm p-3">
      <label className="text-xs">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Work hours start</div>
        <input type="time" value={s} onChange={(ev) => setS(ev.target.value)} className="bg-background border border-border rounded-sm px-2 py-1 text-sm" />
      </label>
      <label className="text-xs">
        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">End</div>
        <input type="time" value={e} onChange={(ev) => setE(ev.target.value)} className="bg-background border border-border rounded-sm px-2 py-1 text-sm" />
      </label>
      <button
        disabled={saving}
        onClick={() => onSave(s, e)}
        className="bg-primary text-primary-foreground text-xs font-bold px-3 py-2 rounded-sm"
      >
        Save
      </button>
    </div>
  );
}

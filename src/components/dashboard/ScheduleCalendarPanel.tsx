import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { addMonths, eligibleDrivers, eligibleVehicles, monthGrid } from "@/lib/schedule-eligibility";
import { assignTripResources } from "@/lib/schedule-board.functions";
import { DriverDetailModal } from "./DriverDetailModal";
import { listVehicles } from "@/lib/fleet.functions";
import { conflictingSlots } from "@/lib/trip-network-rules";
import { useRequestDetails } from '@/components/portal/request-detail-context';
import { ScheduleAssignment } from '@/components/portal/ScheduleAssignment';
import { handleResourceDrop, RESOURCE_MIME, type AssignmentInput } from '@/lib/scheduler-drop';
import { DsButton } from '@/components/ds/controls';
import {scheduleTimeLabel,weeklyLocalAvailability} from "@/lib/regional-projections";
import {ContractorAssignment} from '@/components/portal/ContractorAssignment';

export const RESV_DND_MIME = "application/x-reservation-id";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
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
  return `${hh}:00 ${suffix}`;
}
function isOnVacation(d: any, iso: string) {
  if (!d?.vacation_start || !d?.vacation_end) return false;
  return iso >= String(d.vacation_start).slice(0, 10) && iso <= String(d.vacation_end).slice(0, 10);
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
  const preview = usePortalPreview();
  const [demoAssignments, setDemoAssignments] = useState<Record<string, AssignmentInput>>({});
  const [date, setDate] = useState<string>(todayISO());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [vehicleFilter, setVehicleFilter] = useState("all");
  const [hideEmptyDrivers, setHideEmptyDrivers] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [openDriverId, setOpenDriverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthOpen, setMonthOpen] = useState(false);

  const whFn = useServerFn(getMyWorkHours);
  const driversFn = useServerFn(listMyDrivers);
  const resvFn = useServerFn(listReservationsForDay);
  const assignFn = useServerFn(assignDriverSlot);

  const vehiclesQ = usePortalQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const whQ = usePortalQuery({ queryKey: ["work-hours"], queryFn: () => whFn() });
  const driversQ = usePortalQuery({ queryKey: ["my-drivers"], queryFn: () => driversFn() });
  const resvQ = usePortalQuery({
    queryKey: ["day-reservations", date],
    queryFn: () => resvFn({ data: { date } }),
  });

  const mAssign = usePortalMutation({
    mutationFn: (v: { reservation_id: string; driver_id: string | null; scheduled_start_time: string | null }) =>
      assignFn({ data: v }),
    onSuccess: () => {
      toast.success("Schedule saved");
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
  const allReservations = useMemo(() => (resvQ.data ?? []).map(r => {
    const simulated = preview.active ? demoAssignments[r.id] : undefined;
    return simulated ? { ...r, driver_id: simulated.driverId, assigned_driver_id: simulated.driverId, vehicle_id: simulated.vehicleId, scheduled_start_time: simulated.start, assignment_end_time: simulated.end } : r;
  }), [resvQ.data, preview.active, demoAssignments]);
  const conflicts = useMemo(() => conflictingSlots(allReservations as any), [allReservations]);

  const statusOptions = useMemo(
    () => Array.from(new Set(allReservations.map((r: any) => r.status).filter(Boolean))) as string[],
    [allReservations],
  );

  const reservations = useMemo(
    () => allReservations.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (vehicleFilter === "unassigned" && r.vehicle_id) return false;
      if (vehicleFilter !== "all" && vehicleFilter !== "unassigned" && r.vehicle_id !== vehicleFilter) return false;
      if (driverFilter === "unassigned" && r.assigned_driver_id) return false;
      if (driverFilter !== "all" && driverFilter !== "unassigned" && r.assigned_driver_id !== driverFilter) return false;
      return true;
    }),
    [allReservations, statusFilter, driverFilter, vehicleFilter],
  );

  const drivers = useMemo(() => {
    // Only drivers actually on duty for the selected day: active, not on vacation,
    // and not marked off for this day of the week.
    // Inactive drivers never take new assignments; they stay visible (flagged) when they still
    // hold assignments for this day, or when "Include inactive" is chosen.
    const holding = new Set(allReservations.map((r: any) => r.assigned_driver_id).filter(Boolean));
    let list = allDrivers.filter((d: any) => {
      if (d.status !== "active") return includeInactive || holding.has(d.id);
      if (isOnVacation(d, date)) return false;
      const a = d?.availability;
      if (a && typeof a === "object" && a.mode === "weekly") {
        const day = a.days?.[dow];
        if (!day || day.off) return false;
      }
      return true;
    });
    if (driverFilter !== "all" && driverFilter !== "unassigned") {
      list = list.filter((d: any) => d.id === driverFilter);
    }
    if (hideEmptyDrivers) {
      const active = new Set(reservations.map((r: any) => r.assigned_driver_id).filter(Boolean));
      list = list.filter((d: any) => active.has(d.id));
    }
    return list;
  }, [allDrivers, allReservations, includeInactive, driverFilter, hideEmptyDrivers, reservations, date, dow]);

  // Hour columns: work-hour range, extended to include any reservation times that fall outside.
  const hours = useMemo(() => {
    let minH = closed ? 6 : Math.min(workStartH, 6);
    let maxH = closed ? 20 : Math.max(workEndH, 20);
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
      m.get(key)?.push(r);
    });
    return m;
  }, [reservations]);

  const unassigned = reservations.filter((r: any) => !r.assigned_driver_id);
  const selectedTrip: any = allReservations.find((r: any) => r.id === (selectedId ?? draggingId)) ?? null;
  // Right-column lists honor the same driver/vehicle/active filters as the board.
  const eligible = useMemo(() => {
    if (!selectedTrip) return { drivers: [], vehicles: [] };
    const ds = eligibleDrivers(selectedTrip, drivers.filter((d: any) => d.status === 'active'), allReservations as any, date, Number(dow));
    const vs = eligibleVehicles(selectedTrip, (vehiclesQ.data ?? []).filter((v: any) => vehicleFilter === 'all' || vehicleFilter === 'unassigned' || v.id === vehicleFilter), allReservations as any);
    return { drivers: ds, vehicles: vs };
  }, [selectedTrip, drivers, allReservations, date, dow, vehiclesQ.data, vehicleFilter]);

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
    return !weeklyLocalAvailability(d.availability?.days??{},Number(dow),hhmm);
  }

  const resFn = useServerFn(assignTripResources);
  const mResource = usePortalMutation({
    mutationFn: (input: AssignmentInput) => resFn({ data: input }),
    onSuccess: () => { toast.success("Assignment saved"); ['day-reservations','range-reservations','my-reservations','provider-trips'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); },

  });
  async function resourceDrop(r: any, raw: string) {
    if (mResource.isPending) return;
    try {
      await handleResourceDrop({ raw, trip: r, drivers: allDrivers, vehicles: vehiclesQ.data ?? [], preview: preview.active,
        assign: input => mResource.mutateAsync(input),
        simulate: input => { setDemoAssignments(previous => ({ ...previous, [input.tripId]: input })); toast.info('Preview assignment updated — nothing saved or sent.'); },
      });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Assignment unavailable. Previous assignment unchanged.'); }
  }

  function onDrop(e: React.DragEvent, driverId: string | null, hour: string) {
    e.preventDefault();
    if (e.dataTransfer.types.includes(RESOURCE_MIME)) return;
    const id = e.dataTransfer.getData(RESV_DND_MIME) || draggingId;
    if (!id) return;
    if (driverId && allDrivers.find((d: any) => d.id === driverId)?.status !== "active") { toast.error("This driver is inactive and cannot receive new assignments."); setDraggingId(null); return; }
    if (preview.active) {
      const trip = allReservations.find(r => r.id === id);
      if (trip) { setDemoAssignments(previous => ({ ...previous, [id]: { tripId: id, driverId, vehicleId: trip.vehicle_id ?? null, start: hour, end: trip.assignment_end_time?.slice(0, 5) ?? null } })); toast.info('Preview schedule updated — nothing saved or sent.'); }
      setDraggingId(null); return;
    }
    mAssign.mutate({
      reservation_id: id,
      driver_id: driverId,
      scheduled_start_time: hour,
    });
    setDraggingId(null); setSelectedId(null);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="ds-subheading uppercase text-ds-primary">Day schedule</h2>
      </div>

      {/* Date navigator — larger day/month controls beside the date, month drilldown below */}
      <div className="schedule-nav rounded-ds-sm bg-ds-sky px-3 py-3">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="schedule-nav-btn" onClick={() => setDate(addMonths(date, -1))} aria-label="Previous month"><ChevronsLeft className="size-5" /></button>
          <button type="button" className="schedule-nav-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="size-5" /></button>
          <div className="min-w-0 px-2 text-center"><div className="ds-subheading text-ds-primary" aria-live="polite">{fmtDate(date)}</div></div>
          <button type="button" className="schedule-nav-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="size-5" /></button>
          <button type="button" className="schedule-nav-btn" onClick={() => setDate(addMonths(date, 1))} aria-label="Next month"><ChevronsRight className="size-5" /></button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <DsButton variant="ghost" size="sm" onClick={() => setDate(todayISO())} className="text-xs font-bold">Jump to today</DsButton>
          <DsButton variant="ghost" size="sm" aria-expanded={monthOpen} onClick={() => setMonthOpen(o => !o)} className="text-xs font-bold"><CalendarDays className="size-4" />{monthOpen ? 'Hide month' : 'Month view'}</DsButton>
        </div>
        {monthOpen && <div className="mx-auto mt-3 max-w-sm" role="grid" aria-label={`Month of ${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}>
          <div className="grid grid-cols-7 text-center ds-caption font-bold">{['S','M','T','W','T','F','S'].map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}</div>
          <div className="mt-1 grid grid-cols-7 gap-1">{monthGrid(date).map((d, i) => d ? <button key={d} type="button" onClick={() => { setDate(d); setMonthOpen(false); }} aria-label={`View ${fmtDate(d)}`} aria-current={d === date ? 'date' : undefined} className={`schedule-month-day ${d === date ? 'is-selected' : ''} ${d === todayISO() ? 'is-today' : ''}`}>{Number(d.slice(8))}</button> : <span key={`b${i}`} />)}</div>
        </div>}
      </div>

      {(() => { const inactiveHeld = allReservations.filter((r: any) => (r.assigned_driver_id && allDrivers.find((d: any) => d.id === r.assigned_driver_id)?.status === "inactive") || (r.vehicle_id && (vehiclesQ.data ?? []).find((v: any) => v.id === r.vehicle_id)?.status === "inactive")); return inactiveHeld.length > 0 && <div role="alert" className="rounded-ds bg-ds-surface p-4 text-ds-error"><strong>NEEDS ATTENTION</strong><p className="ds-body">{inactiveHeld.length} trips are still assigned to an inactive driver or vehicle. The assignment is kept; reassign to an active resource when ready.</p></div>; })()}
      {conflicts.size > 0 && <div role="alert" className="rounded-ds bg-ds-surface p-4 text-ds-error"><strong>NEEDS ATTENTION</strong><p className="ds-body">{conflicts.size} trips have overlapping driver, vehicle or trip times.</p><ul className="ds-support">{allReservations.filter(r => conflicts.has(r.id)).map(r => <li key={r.id}>{r.pickup_time} · {r.pickup_city} → {r.dropoff_city}</li>)}</ul></div>}
      {/* Filters — one aligned row of equal-height shared toolbar controls */}
      <div className="portal-filter-grid schedule-filters">
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="portal-control"
          aria-label="Filter by vehicle"
        >
          <option value="all">All vehicles</option>
          <option value="unassigned">No vehicle assigned</option>
          {(vehiclesQ.data ?? []).filter((v: any) => includeInactive || v.status === "active" || allReservations.some((r: any) => r.vehicle_id === v.id)).map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.status && v.status !== "active" ? " (inactive)" : ""}</option>)}
        </select>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="portal-control"
          aria-label="Filter drivers on board"
        >
          <option value="all">All drivers</option>
          <option value="unassigned">Unassigned only</option>
          {allDrivers.filter((d: any) => !isOnVacation(d, date) && (includeInactive || d.status === "active" || allReservations.some((r: any) => r.assigned_driver_id === d.id))).map((d: any) => (
            <option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.status !== "active" ? " (inactive)" : ""}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="portal-control"
          aria-label="Filter reservations on board by status"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="portal-control cursor-pointer">
          <input
            type="checkbox"
            checked={hideEmptyDrivers}
            onChange={(e) => setHideEmptyDrivers(e.target.checked)}
          />
          Hide empty drivers
        </label>
        <select value={includeInactive ? "include" : "active"} onChange={(e) => setIncludeInactive(e.target.value === "include")} className="portal-control" aria-label="Active or inactive resources">
          <option value="active">Active only</option>
          <option value="include">Include inactive</option>
        </select>
        <div className="ds-caption self-center sm:col-span-1 xl:col-span-3">
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

      {/* Unassigned: draggable trips left, eligible drivers/vehicles for the selected trip right */}
      <section
        className="schedule-unassigned rounded-ds-sm border border-dashed border-ds-border bg-ds-surface p-3"
        aria-label="Unassigned trips"
        onDragOver={(e) => { if (!e.dataTransfer.types.includes(RESOURCE_MIME)) e.preventDefault(); }}
        onDrop={(e) => onDrop(e, null, hours[0] ?? "00:00")}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <h3 className="ds-label text-ds-primary">Unassigned ({unassigned.length}) <span className="ds-caption font-normal">· drop a trip here to unschedule</span></h3>
            {unassigned.length === 0 ? <p className="ds-caption mt-2">All reservations assigned.</p> : (
              <ul className="mt-2 space-y-2">{unassigned.map((r: any) => (
                <li key={r.id} className="flex min-w-0 items-start gap-2">
                  <input type="radio" name="schedule-selected-trip" className="mt-2" aria-label={`Select ${scheduleTimeLabel(r)} trip to see eligible drivers`} checked={selectedId === r.id} onChange={() => setSelectedId(r.id)} />
                  <div className="min-w-0 flex-1" onDragStart={() => setSelectedId(r.id)}><ReservationChip r={r} onResourceDrop={resourceDrop} onDragStart={setDraggingId} dragging={draggingId === r.id} tone="unassigned" /></div>
                </li>))}</ul>)}
            {selectedTrip && !selectedTrip.assigned_driver_id && <div className="mt-2"><ContractorAssignment tripId={selectedTrip.id} service={selectedTrip.transport_type} /></div>}
          </div>
          <div className="min-w-0" aria-live="polite">
            <h3 className="ds-label text-ds-primary">{selectedTrip ? `Available for ${scheduleTimeLabel(selectedTrip)}` : 'Available drivers & vehicles'}</h3>
            {!selectedTrip ? <p className="ds-caption mt-2">Select or drag a trip to see drivers on shift, not on time off and free at that time.</p> : <>
              <p className="ds-caption mt-1">Drag onto a trip, or choose Assign to place the selected trip.</p>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Eligible drivers">{eligible.drivers.length === 0 ? <li className="ds-caption">No eligible drivers at this time.</li> : eligible.drivers.map((d: any) => (
                <li key={d.id} draggable onDragStart={e => e.dataTransfer.setData(RESOURCE_MIME, JSON.stringify({ kind: 'driver', id: d.id }))} className="schedule-resource is-driver">
                  <span className="truncate">{d.first_name} {d.last_name}</span><span className="ds-caption">{driverAvailLabel(d)}</span>
                  <button type="button" className="schedule-resource-action" onClick={() => resourceDrop(selectedTrip, JSON.stringify({ kind: 'driver', id: d.id }))} aria-label={`Assign ${d.first_name} ${d.last_name} to selected trip`}>Assign</button>
                </li>))}</ul>
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Eligible vehicles">{eligible.vehicles.length === 0 ? <li className="ds-caption">No eligible vehicles at this time.</li> : eligible.vehicles.map((v: any) => (
                <li key={v.id} draggable onDragStart={e => e.dataTransfer.setData(RESOURCE_MIME, JSON.stringify({ kind: 'vehicle', id: v.id }))} className="schedule-resource is-vehicle">
                  <span className="truncate">{v.name}</span>
                  <button type="button" className="schedule-resource-action" onClick={() => resourceDrop(selectedTrip, JSON.stringify({ kind: 'vehicle', id: v.id }))} aria-label={`Assign vehicle ${v.name} to selected trip`}>Assign</button>
                </li>))}</ul>
            </>}
          </div>
        </div>
        <details className="mt-3 border-t border-ds-border pt-3"><summary className="ds-label cursor-pointer text-ds-link">Assign with forms ({reservations.length})</summary><div className="mt-3 space-y-3">{reservations.map(r=><div key={r.id} className="space-y-2 border-t border-ds-border pt-3"><p className="ds-support break-words">{scheduleTimeLabel(r)} · {r.pickup_city} → {r.dropoff_city}</p><ScheduleAssignment trip={r} drivers={allDrivers.map(d=>({id:d.id,name:`${d.first_name} ${d.last_name}`,status:d.status,regional_service_areas:d.regional_service_areas}))} vehicles={vehiclesQ.data??[]}/></div>)}</div></details>
      </section>

      {/* Calendar grid — time on Y, drivers on X */}
      <div className="min-w-0 rounded-ds-sm border border-ds-border bg-ds-surface overflow-x-auto" role="region" aria-label="Day schedule board" tabIndex={0}>
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
          <table className="w-full text-sm border-collapse">
            <thead className="bg-background/60">
              <tr>
                <th className="sticky left-0 z-10 bg-background/80 border-r border-border text-left text-xs uppercase tracking-wider text-muted-foreground font-bold px-3 py-2 w-44">
                  Time slot
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
                      <div className="text-[10px] font-semibold text-primary" title="Driver availability today">
                        {driverAvailLabel(d)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {hours.map((h) => {
                return (
                  <tr key={h} className="border-t border-border">
                    <td className="sticky left-0 z-10 bg-card border-r border-border px-3 py-2 font-bold whitespace-nowrap">
                      <span className="font-mono text-sm text-primary">{fmt12h(h)}</span>
                    </td>
                    {drivers.map((d: any) => {
                      const key = `${d.id}__${h}`;
                      const cell = cellMap.get(key) ?? [];
                      const unavail = isDriverUnavailable(d, h);
                      return (
                        <td
                          key={d.id}
                          className={`border-r border-border align-top p-1 min-h-[60px] ${unavail ? "bg-muted/40" : "hover:bg-primary/5"}`}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => onDrop(e, d.id, h)}
                          title={unavail ? "Driver is off / outside their working hours" : undefined}
                        >
                          <div className="space-y-1 min-h-[54px]">
                            {cell.map((r: any) => (
                              <ReservationChip key={r.id} r={r} onResourceDrop={resourceDrop} onDragStart={setDraggingId} dragging={draggingId === r.id} small tone={conflicts.has(r.id) ? "conflict" : "assigned"} />
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
  r, onDragStart, onResourceDrop, dragging, small = false, tone = "assigned",
}: {
  r: any;
  onDragStart: (id: string) => void;
  onResourceDrop: (r: any, raw: string) => void;
  dragging: boolean;
  small?: boolean;
  tone?: 'assigned' | 'unassigned' | 'conflict';
}) {
  const openDetails = useRequestDetails();
  const t = (r.scheduled_start_time ?? r.pickup_time ?? "").toString().slice(0, 5);
  return (
    <div
      draggable
      role="button" tabIndex={0} aria-label="Open scheduled trip"
      onClick={() => openDetails({ kind: 'trip', id: r.id })}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetails({ kind: 'trip', id: r.id }); } }}
      onDragStart={(e) => { e.dataTransfer.setData(RESV_DND_MIME, r.id); e.dataTransfer.effectAllowed = "move"; onDragStart(r.id); }}
      onDragOver={(e) => { if (e.dataTransfer.types.includes(RESOURCE_MIME)) e.preventDefault(); }}
      onDrop={(e) => { const raw = e.dataTransfer.getData(RESOURCE_MIME); if (!raw) return; e.preventDefault(); e.stopPropagation(); onResourceDrop(r, raw); }}
      data-schedule-tone={tone} className={`schedule-chip cursor-grab active:cursor-grabbing rounded-sm px-2 py-1 text-xs ${dragging ? "opacity-50" : ""}`}
      title={`${r.patient_first_name} ${r.patient_last_name}\n${r.pickup_address} → ${r.dropoff_address}`}
    >
      <div className="font-bold">
        {scheduleTimeLabel(r)} · {r.patient_first_name} {r.patient_last_name}
      </div>
      {!small && (
        <div className="text-[10px] text-muted-foreground">
          {r.pickup_city} → {r.dropoff_city}
        </div>
      )}
    </div>
  );
}

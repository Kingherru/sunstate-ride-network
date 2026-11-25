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
import { useRouteContext } from '@tanstack/react-router';
import { getDayRoster,setDayRoster,getScheduleRecommendations,confirmScheduleBatch } from '@/lib/schedule-roster.functions';
import { getPortalPreferences } from '@/lib/portal-preferences.functions';
import { clockTime, movedScheduleEnd, dailyRosterIds, driverDayReason, recommendSchedule, uniqueScheduleTrips, type Recommendation } from '@/lib/schedule-planning';
import { ScheduleSplit } from '@/components/portal/ScheduleSplit';
import { scheduleInterval } from '@/lib/regional-projections';
const DRIVER_ROSTER_MIME='application/x-mfn-day-driver';

export const RESV_DND_MIME = "application/x-reservation-id";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import {
  getMyWorkHours,
  listMyDrivers,
  listReservationsForDay,
  assignDriverSlot,
  listReservationsForRange,
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
  const {access}=useRouteContext({strict:false});
  const workspaceId=preview.active?'preview-ws':access?.primary?.id;
  const [demoRoster,setDemoRoster]=useState<Record<string,string[]>>({});
  const [review,setReview]=useState<{proposed:Recommendation[];unmatched:{tripId:string;reason:string}[]}|null>(null);
  const [reviewKey,setReviewKey]=useState('');
  const [batchBusy,setBatchBusy]=useState(false);
  const prefs=usePortalQuery({queryKey:['portal-preferences'],queryFn:()=>getPortalPreferences()});
  const clock=prefs.data?.schedule_clock??'12';
  const time=(v:string|null|undefined)=>clockTime(v,clock);
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

  const rosterGet=useServerFn(getDayRoster),rosterSave=useServerFn(setDayRoster),recommend=useServerFn(getScheduleRecommendations),confirmBatch=useServerFn(confirmScheduleBatch);
  const rosterQ=usePortalQuery({queryKey:['schedule-day-roster',date,workspaceId],queryFn:()=>{if(!workspaceId)throw new Error('Provider workspace required');return rosterGet({data:{workspaceId,date}});},enabled:!!workspaceId});
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

  const monthStart = date.slice(0, 8) + '01';
  const monthEnd = addMonths(monthStart, 1).slice(0, 8) + '01';
  const rangeFn = useServerFn(listReservationsForRange);
  const monthQ = usePortalQuery({ queryKey: ["month-reservations", monthStart], queryFn: () => rangeFn({ data: { start: monthStart, end: addDays(monthEnd, -1) } }), enabled: monthOpen });
  const monthCounts = useMemo(() => { const m = new Map<string, { total: number; open: number }>(); ((monthQ.data ?? []) as any[]).forEach(r => { const k = String(r.pickup_date).slice(0, 10); const c = m.get(k) ?? { total: 0, open: 0 }; c.total++; if (!r.driver_id) c.open++; m.set(k, c); }); return m; }, [monthQ.data]);
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
  const allReservations = useMemo(() => uniqueScheduleTrips((resvQ.data ?? []).map(r => {
    const simulated = preview.active ? demoAssignments[`${date}:${r.id}`] : undefined;
    return simulated ? { ...r, driver_id: simulated.driverId, assigned_driver_id: simulated.driverId, vehicle_id: simulated.vehicleId, scheduled_start_time: simulated.start, assignment_end_time: simulated.end } : r;
  })), [resvQ.data, preview.active, demoAssignments,date]);
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

  const rosterIds=dailyRosterIds(preview.active?(demoRoster[date]??(rosterQ.data??[]).map(r=>r.driver_id)):(rosterQ.data??[]).map(r=>r.driver_id),allReservations);
  const drivers=allDrivers.filter((d:any)=>rosterIds.includes(d.id)&&(includeInactive||d.status==='active'||allReservations.some(r=>r.assigned_driver_id===d.id))).filter((d:any)=>driverFilter==='all'||driverFilter==='unassigned'||driverFilter===d.id).filter((d:any)=>!hideEmptyDrivers||reservations.some(r=>r.assigned_driver_id===d.id));
  const unscheduledDrivers=allDrivers.filter((d:any)=>!rosterIds.includes(d.id)&&(driverFilter==='all'||driverFilter==='unassigned'||driverFilter===d.id));
  async function rosterDriver(driverId:string,scheduled=true){
   const driver=allDrivers.find(d=>d.id===driverId);if(scheduled&&driver&&driverDayReason(driver,date)){toast.error(driverDayReason(driver,date));return;}
   if(!scheduled&&allReservations.some(r=>r.assigned_driver_id===driverId)){toast.error('Unschedule this driver’s trips first.');return;}
   try{if(preview.active)setDemoRoster(prev=>({...prev,[date]:scheduled?[...new Set([...rosterIds,driverId])]:rosterIds.filter(id=>id!==driverId)}));else if(workspaceId){await rosterSave({data:{workspaceId,date,driverId,scheduled}});await qc.invalidateQueries({queryKey:['schedule-day-roster']});}}catch(e){toast.error(e instanceof Error?e.message:'Roster could not be saved.');}
  }
  async function reviewBatch(){setBatchBusy(true);try{const result=preview.active?recommendSchedule({date,trips:allReservations,drivers:allDrivers,rosterIds}):workspaceId?await recommend({data:{workspaceId,date}}):null;setReview(result);setReviewKey(crypto.randomUUID());}catch(e){toast.error(e instanceof Error?e.message:'Recommendations unavailable.');}finally{setBatchBusy(false);}}
  async function applyBatch(){if(!review||!review.proposed.length)return;setBatchBusy(true);try{if(preview.active){setDemoAssignments(prev=>{const next={...prev};for(const i of review.proposed)next[`${date}:${i.tripId}`]={tripId:i.tripId,driverId:i.driverId,vehicleId:i.vehicleId,start:i.start,end:i.end};return next;});}else if(workspaceId){await confirmBatch({data:{workspaceId,date,key:reviewKey,items:review.proposed.map(({reasons,...i})=>i)}});await Promise.all(['day-reservations','schedule-day-roster','provider-trips','month-reservations'].map(k=>qc.invalidateQueries({queryKey:[k]})));}setReview(null);toast.success(preview.active?'Synthetic batch applied — no records or notices.':'Reviewed batch saved');}catch(e){toast.error(e instanceof Error?e.message:'Batch was not saved.');}finally{setBatchBusy(false);}}

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

  const unassigned = reservations.filter((r: any) => !r.assigned_driver_id&&(r.reservation_state==='booked'||['scheduled','confirmed','assigned','accepted'].includes(r.status)));
  const selectedTrip: any = allReservations.find((r: any) => r.id === (selectedId ?? draggingId)) ?? null;
  // Right-column lists honor the same driver/vehicle/active filters as the board.

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
    return `${time(cfg.day.start??"09:00")}–${time(cfg.day.end??"17:00")}`;
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
    onSuccess: () => { toast.success("Assignment saved"); ['day-reservations','schedule-day-roster','range-reservations','my-reservations','provider-trips','month-reservations'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); },

  });
  async function resourceDrop(r: any, raw: string) {
    if (mResource.isPending) return;
    try {
      await handleResourceDrop({ raw, trip: r, drivers: allDrivers, vehicles: vehiclesQ.data ?? [], preview: preview.active,
        assign: input => mResource.mutateAsync(input),
        simulate: input => { setDemoAssignments(previous => ({ ...previous, [`${date}:${input.tripId}`]: input })); toast.info('Preview assignment updated — nothing saved or sent.'); },
      });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Assignment unavailable. Previous assignment unchanged.'); }
  }

  function onDrop(e: React.DragEvent, driverId: string | null, hour: string) {
    e.preventDefault();e.stopPropagation();
    if (e.dataTransfer.types.includes(DRIVER_ROSTER_MIME)){const id=e.dataTransfer.getData(DRIVER_ROSTER_MIME);if(id)void rosterDriver(id);return;}
    if (e.dataTransfer.types.includes(RESOURCE_MIME)) return;
    const id = e.dataTransfer.getData(RESV_DND_MIME) || draggingId;
    if (!id) return;
    placeTrip(id, driverId, hour);
  }
  /** Shared by pointer drops and tap/keyboard controls. */
  function placeTrip(id: string, driverId: string | null, hour: string) {
    if (driverId && allDrivers.find((d: any) => d.id === driverId)?.status !== "active") { toast.error("This driver is inactive and cannot receive new assignments."); setDraggingId(null); return; }
    const trip = allReservations.find(r => r.id === id);if(!trip)return;
    const end=driverId?movedScheduleEnd(trip,hour):trip.assignment_end_time?.slice(0,5)??null;
    if(driverId&&!end){toast.error('Review the trip end time before scheduling.');return;}
    if (preview.active) {
      if(trip&&driverId){const moved={...trip,scheduled_start_time:hour,assignment_end_time:end};if(!eligibleDrivers(moved,allDrivers,allReservations,date,Number(dow)).some(d=>d.id===driverId)){toast.error('Driver unavailable or schedule overlap. Previous placement retained.');return;}setDemoRoster(prev=>({...prev,[date]:[...new Set([...rosterIds,driverId])]}));}
      if(trip&&!driverId)setDemoRoster(prev=>({...prev,[date]:[...rosterIds]}));
      if (trip) { setDemoAssignments(previous => ({ ...previous, [`${date}:${id}`]: { tripId: id, driverId, vehicleId: trip.vehicle_id ?? null, start: hour, end } })); toast.info('Preview schedule updated — nothing saved or sent.'); }
      setDraggingId(null);setSelectedId(null); return;
    }
    mResource.mutate({tripId:id,driverId,vehicleId:trip.vehicle_id??null,start:hour,end});
    setDraggingId(null); setSelectedId(null);
  }

  function renderDailyBoard(referrals:boolean){
   const rows=reservations.filter((r:any)=>Boolean(r.network_distribution_id)===referrals);
   const boardDrivers=referrals?drivers.filter((d:any)=>rows.some(r=>r.assigned_driver_id===d.id)||rows.some(r=>!r.assigned_driver_id)):drivers;
   return <section className="min-w-0" aria-label={referrals?'Referrals schedule':'Provider Drivers and Contractors schedule'} onDragOver={e=>{if(e.dataTransfer.types.includes(DRIVER_ROSTER_MIME))e.preventDefault();}} onDrop={e=>{const id=e.dataTransfer.getData(DRIVER_ROSTER_MIME);if(id){e.preventDefault();e.stopPropagation();void rosterDriver(id);}}}><h3 className="ds-label mb-2 text-ds-primary">{referrals?'Referrals':'Provider Drivers and Contractors'}</h3><div className="schedule-day-grid rounded-ds-sm border border-ds-border" role="region" aria-label={referrals?'Referrals day board':'Provider day board'} tabIndex={0}><table className="w-full border-collapse text-sm"><thead><tr><th className="text-left px-2 py-3 ds-caption">Time Slot / Daily Drivers</th>{boardDrivers.map((d:any)=><th key={d.id} className="min-w-44 px-2 py-2 text-left"><DsButton variant="ghost" size="sm" onClick={()=>setOpenDriverId(d.id)}>{d.first_name} {d.last_name}</DsButton><div className="ds-caption">{rows.filter(r=>r.assigned_driver_id===d.id).length} trips · {driverAvailLabel(d)}</div><DsButton variant="ghost" size="sm" disabled={allReservations.some(r=>r.assigned_driver_id===d.id)} onClick={()=>rosterDriver(d.id,false)} aria-label={`Remove ${d.first_name} from daily roster`}>Remove</DsButton></th>)}</tr></thead><tbody>{hours.map(h=><tr key={h} className="border-t border-ds-border"><td className="px-2 py-2 whitespace-nowrap text-ds-primary font-semibold">{time(h)}</td>{boardDrivers.map((d:any)=>{const cell=rows.filter((r:any)=>r.assigned_driver_id===d.id&&(r.scheduled_start_time??r.pickup_time??'').slice(0,2)===h.slice(0,2));const unavailable=isDriverUnavailable(d,h)||!!driverDayReason(d,date);return <td key={d.id} data-slot={`${d.id}__${h}`} data-schedule-side={referrals?'referral':'provider'} className="border-l border-ds-border p-1 align-top" title={unavailable?'Outside driver availability':undefined} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,d.id,h)}><div className="min-h-14 space-y-2">{cell.map((r:any)=><div key={r.id}><ReservationChip r={r} clock={clock} onResourceDrop={resourceDrop} onDragStart={setDraggingId} dragging={draggingId===r.id} small tone={conflicts.has(r.id)?'conflict':'assigned'}/><div className="mt-1 flex gap-1"><DsButton size="sm" variant="ghost" onClick={()=>setSelectedId(r.id)} aria-pressed={selectedId===r.id} aria-label={`Move ${r.patient_first_name} trip`}>Move</DsButton><DsButton size="sm" variant="ghost" onClick={()=>placeTrip(r.id,null,(r.pickup_time??h).slice(0,5))} aria-label={`Unschedule ${r.patient_first_name} trip`}>Unschedule</DsButton></div></div>)}{selectedTrip&&Boolean(selectedTrip.network_distribution_id)===referrals&&!unavailable&&!cell.some(r=>r.id===selectedTrip.id)&&<DsButton variant="ghost" size="sm" className="schedule-place" onClick={()=>placeTrip(selectedTrip.id,d.id,h)} aria-label={`Place selected trip with ${d.first_name} at ${time(h)}`}>Place here</DsButton>}</div></td>;})}</tr>)}</tbody></table>{!boardDrivers.length&&<p className="p-3 ds-support">{referrals?'No assigned referral drivers.':'Schedule a driver to start the daily roster.'}</p>}</div></section>;
  }

  return (
    <div className="space-y-5">

      {/* Date navigator — larger day/month controls beside the date, month drilldown below */}
      <div className="schedule-nav rounded-ds-sm bg-ds-sky px-3 py-3">
        <div className="schedule-date-controls flex items-center justify-center gap-1">
          <DsButton type="button" variant="ghost" className="schedule-nav-btn" onClick={() => setDate(addMonths(date, -1))} aria-label="Previous month"><ChevronsLeft className="size-5" /></DsButton>
          <DsButton type="button" variant="ghost" className="schedule-nav-btn" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="size-5" /></DsButton>
          <div className="schedule-date-label min-w-0 text-center"><div className="ds-subheading text-ds-primary" aria-live="polite">{fmtDate(date)}</div></div>
          <DsButton type="button" variant="ghost" className="schedule-nav-btn" onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="size-5" /></DsButton>
          <DsButton type="button" variant="ghost" className="schedule-nav-btn" onClick={() => setDate(addMonths(date, 1))} aria-label="Next month"><ChevronsRight className="size-5" /></DsButton>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <DsButton variant="ghost" size="sm" onClick={() => setDate(todayISO())} className="text-xs font-bold">Jump to today</DsButton>
          <DsButton variant="ghost" size="sm" aria-expanded={monthOpen} onClick={() => setMonthOpen(o => !o)} className="text-xs font-bold"><CalendarDays className="size-4" />{monthOpen ? 'Hide month' : 'Month view'}</DsButton>
        </div>
        {monthOpen && <div className="mx-auto mt-3 max-w-sm" role="grid" aria-label={`Month of ${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}>
          <div className="grid grid-cols-7 text-center ds-caption font-bold">{['S','M','T','W','T','F','S'].map((d, i) => <span key={i} aria-hidden="true">{d}</span>)}</div>
          <p className="ds-caption text-center">{monthQ.isLoading ? 'Loading month…' : `${(monthQ.data ?? []).length} trips this month · ${[...monthCounts.values()].reduce((a, c) => a + c.open, 0)} unassigned`}</p><div className="mt-1 grid grid-cols-7 gap-1">{monthGrid(date).map((d, i) => d ? <button key={d} type="button" onClick={() => { setDate(d); setMonthOpen(false); }} aria-label={`View ${fmtDate(d)}${monthCounts.get(d) ? ` — ${monthCounts.get(d)?.total} trips, ${monthCounts.get(d)?.open} unassigned` : ''}`} aria-current={d === date ? 'date' : undefined} className={`schedule-month-day ${d === date ? 'is-selected' : ''} ${d === todayISO() ? 'is-today' : ''}`}><span>{Number(d.slice(8))}</span>{monthCounts.get(d) && <span className="schedule-month-count" aria-hidden="true">{monthCounts.get(d)?.total}{monthCounts.get(d)?.open ? ` · ${monthCounts.get(d)?.open} open` : ''}</span>}</button> : <span key={`b${i}`} />)}</div>
        </div>}
      </div>

      {(() => { const inactiveHeld = allReservations.filter((r: any) => (r.assigned_driver_id && allDrivers.find((d: any) => d.id === r.assigned_driver_id)?.status === "inactive") || (r.vehicle_id && (vehiclesQ.data ?? []).find((v: any) => v.id === r.vehicle_id)?.status === "inactive")); return inactiveHeld.length > 0 && <div role="alert" className="rounded-ds bg-ds-surface p-4 text-ds-error"><strong>NEEDS ATTENTION</strong><p className="ds-body">{inactiveHeld.length} trips are still assigned to an inactive driver or vehicle. The assignment is kept; reassign to an active resource when ready.</p></div>; })()}
      {conflicts.size > 0 && <div role="alert" className="rounded-ds bg-ds-surface p-4 text-ds-error"><strong>NEEDS ATTENTION</strong><p className="ds-body">{conflicts.size} trips have overlapping driver, vehicle or trip times.</p><ul className="ds-support">{allReservations.filter(r => conflicts.has(r.id)).map(r => <li key={r.id}>{r.pickup_time} · {r.pickup_city} → {r.dropoff_city}</li>)}</ul></div>}
      {/* Filters — one aligned row of equal-height shared toolbar controls */}
      <div className="portal-filter-grid schedule-filters">
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="portal-control schedule-filter is-vehicle"
          aria-label="Filter by vehicle"
        >
          <option value="all">All vehicles</option>
          <option value="unassigned">No vehicle assigned</option>
          {(vehiclesQ.data ?? []).filter((v: any) => includeInactive || v.status === "active" || allReservations.some((r: any) => r.vehicle_id === v.id)).map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.status && v.status !== "active" ? " (inactive)" : ""}</option>)}
        </select>
        <select
          value={driverFilter}
          onChange={(e) => setDriverFilter(e.target.value)}
          className="portal-control schedule-filter is-driver"
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
          className="portal-control schedule-filter is-status"
          aria-label="Filter reservations on board by status"
        >
          <option value="all">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="portal-control schedule-filter is-empty cursor-pointer">
          <input
            type="checkbox"
            checked={hideEmptyDrivers}
            onChange={(e) => setHideEmptyDrivers(e.target.checked)}
          />
          Hide empty drivers
        </label>
        <select value={includeInactive ? "include" : "active"} onChange={(e) => setIncludeInactive(e.target.value === "include")} className="portal-control schedule-filter is-active" aria-label="Active or inactive resources">
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

      <div className="schedule-upper">
        <section className="min-w-0" aria-label="Unscheduled Trips" onDragOver={e=>{if(!e.dataTransfer.types.includes(DRIVER_ROSTER_MIME))e.preventDefault();}} onDrop={e=>onDrop(e,null,selectedTrip?.pickup_time?.slice(0,5)??'00:00')}>
          <h3 className="ds-label text-ds-primary">Unscheduled Trips ({unassigned.length})</h3>
          <ul className="schedule-upper-list mt-2 space-y-2">{unassigned.length===0?<li className="ds-caption">No booked trips waiting for assignment.</li>:unassigned.map((r:any)=><li key={r.id} className="flex min-w-0 items-start gap-2"><input type="radio" name="schedule-selected-trip" className="mt-3" aria-label={`Select ${r.patient_first_name} trip`} checked={selectedId===r.id} onChange={()=>setSelectedId(r.id)}/><div className="min-w-0 flex-1"><ReservationChip r={r} clock={clock} onResourceDrop={resourceDrop} onDragStart={id=>{setDraggingId(id);setSelectedId(id);}} dragging={draggingId===r.id} tone="unassigned"/></div></li>)}</ul>
        </section>
        <section className="min-w-0" aria-label="Unscheduled Drivers"><h3 className="ds-label text-ds-primary">Unscheduled Drivers ({unscheduledDrivers.length})</h3><ul className="schedule-upper-list mt-2 space-y-2">{unscheduledDrivers.map((d:any)=>{const dayReason=driverDayReason(d,date);const reason=dayReason??(selectedTrip&&!eligibleDrivers(selectedTrip,[d],allReservations,date,Number(dow)).length?'Outside shift or overlapping booking for selected trip':null);return <li key={d.id} draggable={!dayReason} onDragStart={e=>{e.dataTransfer.setData(DRIVER_ROSTER_MIME,d.id);e.dataTransfer.effectAllowed='move';}} className={`schedule-resource flex-wrap ${reason?'is-unavailable':'is-driver'}`}><span>{d.first_name} {d.last_name}</span><details><summary className="ds-caption cursor-pointer" title={reason??`Available · ${driverAvailLabel(d)}`}>{reason?'Unavailable':'Available'}</summary><p className="ds-caption">{reason??driverAvailLabel(d)}</p></details><DsButton size="sm" variant="ghost" disabled={!!dayReason} onClick={()=>rosterDriver(d.id)} aria-label={`Schedule ${d.first_name} ${d.last_name}`}>Schedule driver</DsButton></li>;})}{!unscheduledDrivers.length&&<li className="ds-caption">All drivers are on the daily roster.</li>}</ul></section>
      </div>
      {rosterQ.isError&&<p role="alert" className="ds-support text-ds-error">Daily roster unavailable. Existing trip assignments are retained.</p>}
      <div className="flex flex-wrap items-center gap-3"><DsButton className="schedule-blue-action" disabled={batchBusy||!unassigned.length} onClick={reviewBatch}>Assign Scheduled Drivers and Trips</DsButton></div>
      {review&&<section aria-label="Review batch recommendations" className="bg-ds-sky rounded-ds-sm p-3 space-y-3"><h3 className="ds-label text-ds-primary">Review recommendations</h3><ul className="space-y-3">{review.proposed.map(i=>{const t=allReservations.find(r=>r.id===i.tripId),d=allDrivers.find(d=>d.id===i.driverId);return <li key={i.tripId}><p className="ds-support font-semibold">{t?.patient_first_name} {t?.patient_last_name} · {d?.first_name} {d?.last_name} · {time(i.start)}–{time(i.end)}</p><p className="ds-caption">{i.reasons.join(' · ')}</p></li>;})}</ul>{review.unmatched.map(i=><p key={i.tripId} className="ds-support">{allReservations.find(r=>r.id===i.tripId)?.patient_first_name}: {i.reason}</p>)}<div className="flex gap-2"><DsButton className="schedule-blue-action" disabled={batchBusy||!review.proposed.length} onClick={applyBatch}>Confirm {review.proposed.length} assignments</DsButton><DsButton variant="ghost" disabled={batchBusy} onClick={()=>setReview(null)}>Cancel</DsButton></div></section>}
      <ScheduleSplit left={renderDailyBoard(false)} right={renderDailyBoard(true)}/>

      {openDriverId && (
        <DriverDetailModal driverId={openDriverId} onClose={() => setOpenDriverId(null)} />
      )}
    </div>
  );
}

function ReservationChip({
  r, clock = "12", onDragStart, onResourceDrop, dragging, small = false, tone = "assigned",
}: {
  r: any;
  clock?: "12" | "24";
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
      data-schedule-trip={r.id} data-schedule-tone={tone} className={`schedule-chip cursor-grab active:cursor-grabbing rounded-sm px-2 py-1 text-xs ${dragging ? "opacity-50" : ""}`}
      title={`${r.patient_first_name} ${r.patient_last_name}\n${r.pickup_address} → ${r.dropoff_address}`}
    >
      <div className="font-bold">{r.appointment_time?`Appointment ${clockTime(r.appointment_time,clock)}`:`Pickup ${clockTime(t,clock)}`} · {r.patient_first_name} {r.patient_last_name}</div>
      <div className="ds-caption">Pickup {clockTime(t,clock)}{r.network_distribution_id?' · Referral':''}</div>
      {!small&&<><p className="ds-support break-words">{r.pickup_address}, {r.pickup_city}</p><p className="ds-support break-words">{r.dropoff_address}, {r.dropoff_city}</p>{Array.isArray(r.additional_stops)&&r.additional_stops.length>0&&<ol className="ds-support list-decimal pl-4 space-y-1">{r.additional_stops.map((leg:any,i:number)=><li key={i}>{clockTime(leg.pickupTime??leg.pickup_time,clock)} · {leg.address}, {leg.city}</li>)}</ol>}{r.service_line==='child_care'&&<p className="ds-caption">Child Care · {r.pickup_date} · {clockTime(r.pickup_time,clock)} · {r.pickup_address}, {r.pickup_city} → {r.dropoff_address}, {r.dropoff_city}</p>}</>}
      {!scheduleInterval(r)&&<p className="ds-caption text-ds-error">Local timing review required</p>}

    </div>
  );
}

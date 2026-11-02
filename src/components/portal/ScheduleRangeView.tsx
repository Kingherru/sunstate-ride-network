import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { listReservationsForRange, listMyDrivers } from "@/lib/schedule-board.functions";
import { listVehicles } from "@/lib/fleet.functions";
import { conflictingSlots } from "@/lib/trip-network-rules";
import { useRequestDetails } from "./request-detail-context";
import { usePortalQuery } from "./preview-data";
import { cn } from "@/lib/utils";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const parse = (s: string) => new Date(s + "T00:00:00Z");
const shift = (s: string, days: number) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
function rangeFor(view: "week" | "month", anchor: string) {
  const d = parse(anchor);
  if (view === "week") { const s = shift(anchor, -((d.getUTCDay() + 6) % 7)); return { start: s, end: shift(s, 6) }; }
  const first = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const s = shift(iso(first), -((first.getUTCDay() + 6) % 7));
  return { start: s, end: shift(iso(last), (7 - ((last.getUTCDay() + 6) % 7) - 1)), month: d.getUTCMonth() };
}
type Row = { id: string; pickup_date: string; pickup_time: string | null; patient_first_name: string | null; patient_last_name: string | null; pickup_city: string | null; dropoff_city: string | null; driver_id: string | null; vehicle_id: string | null; status: string | null; scheduled_start_time: string | null };
export type Attention = "no_driver" | "no_vehicle" | "conflict" | "inactive";
const ATTN: Record<Attention, string> = { no_driver: "Unassigned driver", no_vehicle: "Missing vehicle", conflict: "Schedule conflict", inactive: "Inactive resource" };

/** Week and month views over the same authorized trip data as the day board. Read-only; assignment stays on the day board. */
export function ScheduleRangeView({ view }: { view: "week" | "month" }) {
  const [anchor, setAnchor] = useState(iso(new Date()));
  const [driver, setDriver] = useState("all"); const [vehicle, setVehicle] = useState("all");
  const [status, setStatus] = useState("all"); const [attention, setAttention] = useState(false); const [inactive, setInactive] = useState(false); const [q, setQ] = useState("");
  const r = rangeFor(view, anchor);
  const open = useRequestDetails();
  const trips = usePortalQuery({ queryKey: ["range-reservations", r.start, r.end], queryFn: () => listReservationsForRange({ data: { start: r.start, end: r.end } }) });
  const drivers = usePortalQuery({ queryKey: ["my-drivers"], queryFn: () => listMyDrivers() });
  const vehicles = usePortalQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const rows = ((trips.data ?? []) as Row[]);
  const conflicts = useMemo(() => conflictingSlots(rows as never), [rows]);
  const driverMap = new Map(((drivers.data ?? []) as { id: string; first_name: string; last_name: string; status?: string | null }[]).map((d) => [d.id, d]));
  const vehicleMap = new Map(((vehicles.data ?? []) as { id: string; name: string; status?: string | null }[]).map((v) => [v.id, v]));
  const issues = (t: Row): Attention[] => {
    const out: Attention[] = [];
    if (!t.driver_id) out.push("no_driver");
    if (!t.vehicle_id) out.push("no_vehicle");
    if (conflicts.has(t.id)) out.push("conflict");
    const d = t.driver_id ? driverMap.get(t.driver_id) : null; const v = t.vehicle_id ? vehicleMap.get(t.vehicle_id) : null;
    if ((d && d.status && d.status !== "active") || (v && v.status && v.status !== "active")) out.push("inactive");
    return out;
  };
  const needle = q.trim().toLowerCase();
  const shown = rows.filter((t) => {
    if (driver === "unassigned" ? !!t.driver_id : driver !== "all" && t.driver_id !== driver) return false;
    if (vehicle === "unassigned" ? !!t.vehicle_id : vehicle !== "all" && t.vehicle_id !== vehicle) return false;
    if (status !== "all" && t.status !== status) return false;
    if (attention && issues(t).length === 0) return false;
    if (needle && ![t.patient_first_name, t.patient_last_name, t.pickup_city, t.dropoff_city].join(" ").toLowerCase().includes(needle)) return false;
    return true;
  });
  const days: string[] = []; for (let d = r.start; d <= r.end; d = shift(d, 1)) days.push(d);
  const statuses = Array.from(new Set(rows.map((t) => t.status).filter(Boolean))) as string[];
  const label = view === "week" ? `${parse(r.start).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" })} – ${parse(r.end).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}` : parse(anchor).toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
  const step = (n: number) => { if (view === "week") setAnchor(shift(anchor, 7 * n)); else { const d = parse(anchor); setAnchor(iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)))); } };
  const attnCount = rows.filter((t) => issues(t).length > 0).length;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-label="Previous" onClick={() => step(-1)} className="portal-control"><ChevronLeft className="size-4" /></button>
      <button type="button" onClick={() => setAnchor(iso(new Date()))} className="portal-control">Today</button>
      <button type="button" aria-label="Next" onClick={() => step(1)} className="portal-control"><ChevronRight className="size-4" /></button>
      <input type="date" aria-label="Go to date" value={anchor} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="portal-control" />
      <p className="ds-label text-ds-primary">{label}</p>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))_auto]">
      <label className="relative block"><span className="sr-only">Search trips</span><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ds-text-2" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search passenger or city" className="portal-control w-full !pl-9" /></label>
      <select aria-label="Filter by driver" value={driver} onChange={(e) => setDriver(e.target.value)} className="portal-control"><option value="all">All drivers</option><option value="unassigned">No driver</option>{[...driverMap.values()].filter((d) => inactive || !d.status || d.status === "active" || rows.some((t) => t.driver_id === d.id)).map((d) => <option key={d.id} value={d.id}>{d.first_name} {d.last_name}{d.status && d.status !== "active" ? " (inactive)" : ""}</option>)}</select>
      <select aria-label="Filter by vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)} className="portal-control"><option value="all">All vehicles</option><option value="unassigned">No vehicle</option>{[...vehicleMap.values()].filter((v) => inactive || !v.status || v.status === "active" || rows.some((t) => t.vehicle_id === v.id)).map((v) => <option key={v.id} value={v.id}>{v.name}{v.status && v.status !== "active" ? " (inactive)" : ""}</option>)}</select>
      <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="portal-control"><option value="all">All statuses</option>{statuses.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <select aria-label="Active or inactive resources" value={inactive ? "include" : "active"} onChange={(e) => setInactive(e.target.value === "include")} className="portal-control"><option value="active">Active only</option><option value="include">Include inactive</option></select>
      <label className="portal-control cursor-pointer whitespace-nowrap"><input type="checkbox" checked={attention} onChange={(e) => setAttention(e.target.checked)} />Needs attention ({attnCount})</label>
    </div>
    {trips.isError && <p role="alert" className="ds-support text-ds-error">Schedule could not be loaded.</p>}
    <div className={cn("grid gap-2", view === "week" ? "grid-cols-1 md:grid-cols-7" : "grid-cols-2 sm:grid-cols-4 md:grid-cols-7")}>
      {days.map((d) => {
        const list = shown.filter((t) => t.pickup_date === d);
        const outside = view === "month" && parse(d).getUTCMonth() !== r.month;
        return <section key={d} aria-label={d} className={cn("min-h-28 rounded-ds border border-ds-sky-border p-2", outside ? "bg-ds-bg opacity-60" : "bg-ds-sky")}>
          <h3 className="ds-caption font-semibold uppercase text-ds-primary">{parse(d).toLocaleDateString(undefined, { weekday: "short", day: "numeric", timeZone: "UTC" })}</h3>
          <ul className="mt-1 space-y-1">{list.slice(0, view === "month" ? 4 : 50).map((t) => {
            const iss = issues(t);
            return <li key={t.id}><button type="button" onClick={() => open({ kind: "trip", id: t.id })}
              className={cn("w-full rounded-ds-sm border bg-ds-surface px-2 py-1 text-left text-xs", iss.length ? "border-ds-error/60" : "border-ds-border")}
              title={iss.map((i) => ATTN[i]).join(", ") || undefined}>
              <span className="font-semibold">{(t.scheduled_start_time ?? t.pickup_time ?? "").slice(0, 5) || "Time not provided"}</span>{" "}
              <span className="break-words">{t.pickup_city ?? "Not provided"} → {t.dropoff_city ?? "Not provided"}</span>
              {iss.length > 0 && <span className="block text-ds-error">{iss.map((i) => ATTN[i]).join(" · ")}</span>}
            </button></li>;
          })}{view === "month" && list.length > 4 && <li className="ds-caption">+{list.length - 4} more</li>}</ul>
        </section>;
      })}
    </div>
    <p className="ds-caption">Assign drivers and times from the Day view. Overlapping assignments are flagged, never overwritten.</p>
  </div>;
}

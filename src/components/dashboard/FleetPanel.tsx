import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listDrivers, upsertDriver, deleteDriver,
  listVehicles, upsertVehicle, deleteVehicle,
  sendDriverWeeklySchedule,
} from "@/lib/fleet.functions";

export function FleetPanel({ only }: { only?: "drivers" | "vehicles" } = {}) {
  if (only === "drivers") return <DriversCard />;
  if (only === "vehicles") return <VehiclesCard />;
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <DriversCard />
      <VehiclesCard />
    </div>
  );
}

function DriversCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["drivers"], queryFn: () => listDrivers() });
  const vq = useQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const [editing, setEditing] = useState<any>(null);
  const [scheduling, setScheduling] = useState<any>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteDriver({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["drivers"] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
  });

  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold tracking-tight">Drivers</h2>
        <button onClick={() => setEditing({ status: "active" })} className="text-xs font-bold text-primary hover:underline">+ Add driver</button>
      </div>
      {q.isLoading ? <p className="text-muted-foreground text-sm">Loading…</p>
       : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No drivers yet.</p>
       : (
        <ul className="divide-y divide-border text-sm">
          {q.data!.map((d: any) => {
            const veh = (vq.data ?? []).find((v: any) => v.id === d.primary_vehicle_id);
            return (
            <li key={d.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <div className="font-bold">{d.first_name} {d.last_name}
                  <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">{d.status.replace("_"," ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">{d.phone}{d.license_expiry ? ` · lic exp ${d.license_expiry}` : ""}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {employmentLabel(d.employment_type)} · {availabilitySummary(d.availability)}
                </div>
                {(d.service_capabilities?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Services: {(d.service_capabilities as string[]).map(capLabel).join(", ")}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Vehicle: {veh ? `${veh.name}${veh.plate ? ` (${veh.plate})` : ""}` : "unassigned"}
                </div>
                {d.employment_type === "independent_contractor" && pricingSummary(d.contractor_pricing) && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Pricing: {pricingSummary(d.contractor_pricing)}
                  </div>
                )}
              </div>
              <div className="text-xs flex items-center gap-3">
                {d.email && (
                  <button onClick={() => setScheduling(d)} className="font-bold text-primary hover:underline">Email week</button>
                )}
                <button onClick={() => setEditing(d)} className="font-bold text-primary hover:underline">Edit</button>
                <button onClick={() => confirm("Remove driver?") && del.mutate(d.id)} className="font-bold text-red-600 hover:underline">Remove</button>
              </div>
            </li>
            );
          })}
        </ul>
      )}
      {editing && <DriverDialog d={editing} vehicles={vq.data ?? []} onClose={() => setEditing(null)}
                                onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["drivers"] }); qc.invalidateQueries({ queryKey: ["vehicles"] }); }} />}
      {scheduling && <WeekScheduleDialog d={scheduling} onClose={() => setScheduling(null)} />}
    </section>
  );
}

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "", label: "— Not set —" },
  { value: "independent_contractor", label: "Independent Contractor (1099)" },
  { value: "employee_w2", label: "Employee (W-2)" },
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "temporary", label: "Temporary" },
  { value: "seasonal", label: "Seasonal" },
];

const SERVICE_CAPABILITIES: { value: "ambulatory" | "wheelchair" | "stretcher"; label: string }[] = [
  { value: "ambulatory", label: "Ambulatory" },
  { value: "wheelchair", label: "Wheelchair" },
  { value: "stretcher", label: "Gurney / Stretcher" },
];

const DAY_LABELS: [string, string][] = [
  ["1", "Mon"], ["2", "Tue"], ["3", "Wed"], ["4", "Thu"],
  ["5", "Fri"], ["6", "Sat"], ["0", "Sun"],
];

function capLabel(v: string): string {
  return SERVICE_CAPABILITIES.find(c => c.value === v)?.label ?? v;
}

function centsToDollars(c?: number | null): string {
  if (c == null || Number.isNaN(c)) return "";
  return (c / 100).toFixed(2);
}
function dollarsToCents(s: string): number | null {
  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

const PAY_TYPES: { value: string; label: string }[] = [
  { value: "", label: "— Not set —" },
  { value: "hourly", label: "Hourly" },
  { value: "daily_salary", label: "Daily Salary" },
  { value: "independent_contractor", label: "Independent Contractor (1099)" },
];

function pricingSummary(p: any): string {
  if (!p || typeof p !== "object") return "";
  const parts: string[] = [];
  if (p.hourly_rate_cents) parts.push(`$${centsToDollars(p.hourly_rate_cents)}/hr`);
  if (p.daily_rate_cents) parts.push(`$${centsToDollars(p.daily_rate_cents)}/day`);
  if (p.per_pickup_leg_cents) parts.push(`$${centsToDollars(p.per_pickup_leg_cents)}/leg`);
  if (p.per_trip_cents) parts.push(`$${centsToDollars(p.per_trip_cents)}/trip`);
  if (p.per_mile_cents) parts.push(`$${centsToDollars(p.per_mile_cents)}/mi`);
  if (p.wait_time_per_hour_cents) parts.push(`$${centsToDollars(p.wait_time_per_hour_cents)}/hr wait`);
  if (p.cancellation_fee_cents) parts.push(`$${centsToDollars(p.cancellation_fee_cents)} cancel`);
  return parts.join(" · ");
}

function employmentLabel(v?: string | null) {
  if (!v) return "Employment: not set";
  const found = EMPLOYMENT_TYPES.find(t => t.value === v);
  return found ? found.label : v;
}

function availabilitySummary(a: any): string {

  if (!a || typeof a !== "object") return "Flexible availability";
  if (a.mode === "flexible") return "Flexible / on-call";
  const days = a.days ?? {};
  const working = DAY_LABELS.filter(([k]) => !days[k]?.off);
  if (working.length === 0) return "No working days set";
  // Group by identical hours
  const hours = working.map(([k, l]) => ({ l, s: days[k]?.start ?? "09:00", e: days[k]?.end ?? "17:00" }));
  const allSame = hours.every(h => h.s === hours[0].s && h.e === hours[0].e);
  const dayList = working.map(([, l]) => l).join(", ");
  return allSame ? `${dayList} · ${hours[0].s}–${hours[0].e}` : `${dayList} (varies)`;
}

function defaultAvailability() {
  const days: Record<string, { off?: boolean; start?: string; end?: string }> = {};
  for (const [k] of DAY_LABELS) {
    const weekend = k === "0" || k === "6";
    days[k] = weekend ? { off: true } : { start: "09:00", end: "17:00" };
  }
  return { mode: "weekly" as const, days };
}

function DriverDialog({ d, onClose, onSaved }: { d: any; onClose: () => void; onSaved: () => void }) {
  const initialAvail = d.availability && typeof d.availability === "object"
    ? { mode: (d.availability.mode ?? "weekly") as "weekly" | "flexible", days: d.availability.days ?? {} }
    : defaultAvailability();
  const initialPricing = d.contractor_pricing && typeof d.contractor_pricing === "object" ? d.contractor_pricing : {};
  const [f, set] = useState({
    first_name: d.first_name ?? "", last_name: d.last_name ?? "",
    phone: d.phone ?? "", email: d.email ?? "",
    license_number: d.license_number ?? "", license_expiry: d.license_expiry ?? "",
    status: d.status ?? "active", notes: d.notes ?? "",
    employment_type: d.employment_type ?? "",
    pay_type: d.pay_type ?? "",
    availability: initialAvail,
    service_capabilities: (d.service_capabilities ?? []) as Array<"ambulatory" | "wheelchair" | "stretcher">,
    pricing: {
      hourly_rate: centsToDollars(initialPricing.hourly_rate_cents),
      daily_rate: centsToDollars(initialPricing.daily_rate_cents),
      per_pickup_leg: centsToDollars(initialPricing.per_pickup_leg_cents),
      per_trip: centsToDollars(initialPricing.per_trip_cents),
      per_mile: centsToDollars(initialPricing.per_mile_cents),
      wait_time_per_hour: centsToDollars(initialPricing.wait_time_per_hour_cents),
      cancellation_fee: centsToDollars(initialPricing.cancellation_fee_cents),
      notes: initialPricing.notes ?? "",
    },
  });
  const setDay = (k: string, patch: Partial<{ off: boolean; start: string; end: string }>) =>
    set({ ...f, availability: { ...f.availability, days: { ...f.availability.days, [k]: { ...(f.availability.days[k] ?? {}), ...patch } } } });
  const toggleCap = (v: "ambulatory" | "wheelchair" | "stretcher") =>
    set({ ...f, service_capabilities: f.service_capabilities.includes(v)
      ? f.service_capabilities.filter(x => x !== v)
      : [...f.service_capabilities, v] });
  const isHourly = f.pay_type === "hourly";
  const isDaily = f.pay_type === "daily_salary";
  const isContractor = f.pay_type === "independent_contractor" || f.employment_type === "independent_contractor";
  const m = useMutation({
    mutationFn: () => upsertDriver({ data: {
      id: d.id,
      first_name: f.first_name,
      last_name: f.last_name,
      phone: f.phone,
      email: f.email,
      license_number: f.license_number,
      license_expiry: f.license_expiry || null,
      status: f.status,
      notes: f.notes,
      employment_type: (f.employment_type || null) as any,
      pay_type: (f.pay_type || null) as any,
      availability: f.availability,
      service_capabilities: f.service_capabilities,
      contractor_pricing: (isHourly || isDaily || isContractor) ? {
        hourly_rate_cents: isHourly ? dollarsToCents(f.pricing.hourly_rate) : null,
        daily_rate_cents: isDaily ? dollarsToCents(f.pricing.daily_rate) : null,
        per_pickup_leg_cents: isContractor ? dollarsToCents(f.pricing.per_pickup_leg) : null,
        per_trip_cents: isContractor ? dollarsToCents(f.pricing.per_trip) : null,
        per_mile_cents: isContractor ? dollarsToCents(f.pricing.per_mile) : null,
        wait_time_per_hour_cents: isContractor ? dollarsToCents(f.pricing.wait_time_per_hour) : null,
        cancellation_fee_cents: isContractor ? dollarsToCents(f.pricing.cancellation_fee) : null,
        notes: f.pricing.notes || null,
      } : {},
    } as any }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-2 sm:p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-2xl w-full p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
        <h3 className="sm:col-span-2 text-lg font-extrabold">{d.id ? "Edit driver" : "New driver"}</h3>
        <I l="First name" v={f.first_name} on={(v) => set({ ...f, first_name: v })} req />
        <I l="Last name" v={f.last_name} on={(v) => set({ ...f, last_name: v })} req />
        <I l="Phone" v={f.phone} on={(v) => set({ ...f, phone: v })} />
        <I l="Email" v={f.email} on={(v) => set({ ...f, email: v })} type="email" />
        <I l="License #" v={f.license_number} on={(v) => set({ ...f, license_number: v })} />
        <I l="License expiry" v={f.license_expiry} on={(v) => set({ ...f, license_expiry: v })} type="date" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Status</span>
          <select value={f.status} onChange={(e) => set({ ...f, status: e.target.value as any })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Employment type</span>
          <select value={f.employment_type} onChange={(e) => set({ ...f, employment_type: e.target.value })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        <div className="sm:col-span-2 border border-border rounded-sm p-3">
          <div className="font-bold text-sm mb-2">Service capabilities</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {SERVICE_CAPABILITIES.map(c => (
              <label key={c.value} className="flex items-center gap-1.5">
                <input type="checkbox" checked={f.service_capabilities.includes(c.value)}
                       onChange={() => toggleCap(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            What this driver — and the vehicle they operate — can transport. Used by scheduling and dispatch.
          </p>
        </div>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold">Driver pay type</span>
          <select value={f.pay_type} onChange={(e) => set({ ...f, pay_type: e.target.value })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            {PAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Choose one: Hourly, Daily Salary, or Independent Contractor (1099). Only the fields for the selected pay type are shown.
          </span>
        </label>

        {isHourly && (
          <div className="sm:col-span-2 border border-border rounded-sm p-3">
            <div className="font-bold text-sm mb-2">Hourly pay</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <MoneyI l="Hourly rate ($ / hour)" v={f.pricing.hourly_rate}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, hourly_rate: v } })} />
            </div>
          </div>
        )}

        {isDaily && (
          <div className="sm:col-span-2 border border-border rounded-sm p-3">
            <div className="font-bold text-sm mb-2">Daily salary</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <MoneyI l="Daily pay ($ / day)" v={f.pricing.daily_rate}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, daily_rate: v } })} />
            </div>
          </div>
        )}

        {isContractor && !isHourly && !isDaily && (
          <div className="sm:col-span-2 border border-border rounded-sm p-3">
            <div className="font-bold text-sm mb-2">Independent contractor (1099) pricing</div>
            <p className="text-[11px] text-muted-foreground mb-2">
              Fill in any that apply — leave blank for fees you don't use. Amounts are in US dollars.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <MoneyI l="Per pickup leg" v={f.pricing.per_pickup_leg}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, per_pickup_leg: v } })} />
              <MoneyI l="Per trip" v={f.pricing.per_trip}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, per_trip: v } })} />
              <MoneyI l="Per mile" v={f.pricing.per_mile}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, per_mile: v } })} />
              <MoneyI l="Wait time (per hour)" v={f.pricing.wait_time_per_hour}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, wait_time_per_hour: v } })} />
              <MoneyI l="Cancellation fee" v={f.pricing.cancellation_fee}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, cancellation_fee: v } })} />
              <label className="flex flex-col gap-1 text-xs sm:col-span-2">
                <span className="font-bold">Pricing notes</span>
                <textarea rows={2} value={f.pricing.notes}
                          onChange={(e) => set({ ...f, pricing: { ...f.pricing, notes: e.target.value } })}
                          className="border border-border rounded-sm px-2 py-1 bg-background" />
              </label>
            </div>
          </div>
        )}



        <div className="col-span-2 border border-border rounded-sm p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm">Weekly availability</span>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-bold">Mode</span>
              <select value={f.availability.mode}
                      onChange={(e) => set({ ...f, availability: { ...f.availability, mode: e.target.value as any } })}
                      className="border border-border rounded-sm px-2 py-1 bg-background">
                <option value="weekly">Set weekly hours</option>
                <option value="flexible">Flexible / on-call</option>
              </select>
            </label>
          </div>
          {f.availability.mode === "flexible" ? (
            <p className="text-xs text-muted-foreground">Driver is treated as available at any hour on the schedule board.</p>
          ) : (
            <div className="grid gap-1.5">
              {DAY_LABELS.map(([k, label]) => {
                const day = f.availability.days[k] ?? {};
                const off = !!day.off;
                return (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <span className="w-10 font-bold">{label}</span>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={off} onChange={(e) => setDay(k, { off: e.target.checked })} />
                      <span>Off</span>
                    </label>
                    <input type="time" disabled={off} value={day.start ?? "09:00"}
                           onChange={(e) => setDay(k, { start: e.target.value })}
                           className="border border-border rounded-sm px-2 py-1 bg-background disabled:opacity-40" />
                    <span>–</span>
                    <input type="time" disabled={off} value={day.end ?? "17:00"}
                           onChange={(e) => setDay(k, { end: e.target.value })}
                           className="border border-border rounded-sm px-2 py-1 bg-background disabled:opacity-40" />
                  </div>
                );
              })}
              <div className="flex flex-wrap gap-2 pt-1">
                <button type="button" className="text-[11px] font-bold text-primary hover:underline"
                        onClick={() => set({ ...f, availability: defaultAvailability() })}>
                  Preset: Mon–Fri 9–5
                </button>
                <button type="button" className="text-[11px] font-bold text-primary hover:underline"
                        onClick={() => {
                          const days: any = {};
                          for (const [k] of DAY_LABELS) days[k] = { start: "00:00", end: "23:59" };
                          set({ ...f, availability: { mode: "weekly", days } });
                        }}>
                  Preset: 24/7
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <button disabled={m.isPending} className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function WeekScheduleDialog({ d, onClose }: { d: any; onClose: () => void }) {
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const [weekStart, setWeekStart] = useState(monday.toISOString().slice(0, 10));
  const m = useMutation({
    mutationFn: () => sendDriverWeeklySchedule({ data: { driver_id: d.id, week_start: weekStart } }),
    onSuccess: (r: any) => { toast.success(`Schedule queued — ${r.count} trip${r.count === 1 ? "" : "s"}`); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-sm w-full p-6 grid gap-3">
        <h3 className="text-lg font-extrabold">Email week schedule</h3>
        <p className="text-sm text-muted-foreground">
          Send {d.first_name} {d.last_name} a 7-day trip schedule starting on the date below.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Week start</span>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required
                 className="border border-border rounded-sm px-3 py-2 bg-background" />
        </label>
        <div className="text-xs text-muted-foreground">To: {d.email}</div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <button disabled={m.isPending} className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm disabled:opacity-50">
            {m.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VehiclesCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const [editing, setEditing] = useState<any>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteVehicle({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["vehicles"] }); },
  });
  return (
    <section className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-extrabold tracking-tight">Vehicles</h2>
        <button onClick={() => setEditing({ vehicle_type: "sedan", status: "active", capacity: 4 })}
                className="text-xs font-bold text-primary hover:underline">+ Add vehicle</button>
      </div>
      {q.isLoading ? <p className="text-muted-foreground text-sm">Loading…</p>
       : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No vehicles yet.</p>
       : (
        <ul className="divide-y divide-border text-sm">
          {q.data!.map((v: any) => (
            <li key={v.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-bold">{v.name}
                  <span className="ml-2 text-xs uppercase text-muted-foreground">{v.vehicle_type.replace("_"," ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">{v.plate ?? "no plate"} · cap {v.capacity} · {v.status}</div>
                {(v.service_capabilities?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Services: {(v.service_capabilities as string[]).map(capLabel).join(", ")}
                  </div>
                )}
              </div>
              <div className="text-xs">
                <button onClick={() => setEditing(v)} className="font-bold text-primary hover:underline mr-3">Edit</button>
                <button onClick={() => confirm("Remove vehicle?") && del.mutate(v.id)} className="font-bold text-red-600 hover:underline">Remove</button>
              </div>
            </li>

          ))}
        </ul>
      )}
      {editing && <VehicleDialog v={editing} onClose={() => setEditing(null)}
                                 onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["vehicles"] }); }} />}
    </section>
  );
}

function VehicleDialog({ v, onClose, onSaved }: { v: any; onClose: () => void; onSaved: () => void }) {
  const [f, set] = useState({
    name: v.name ?? "", plate: v.plate ?? "",
    vehicle_type: v.vehicle_type ?? "sedan",
    capacity: v.capacity ?? 4, status: v.status ?? "active", notes: v.notes ?? "",
    service_capabilities: (v.service_capabilities ?? []) as Array<"ambulatory" | "wheelchair" | "stretcher">,
  });
  const toggleCap = (val: "ambulatory" | "wheelchair" | "stretcher") =>
    set({ ...f, service_capabilities: f.service_capabilities.includes(val)
      ? f.service_capabilities.filter(x => x !== val)
      : [...f.service_capabilities, val] });
  const m = useMutation({
    mutationFn: () => upsertVehicle({ data: { ...f, id: v.id, capacity: Number(f.capacity) } as any }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-lg w-full p-6 grid grid-cols-2 gap-3 max-h-[90vh] overflow-y-auto">
        <h3 className="col-span-2 text-lg font-extrabold">{v.id ? "Edit vehicle" : "New vehicle"}</h3>

        <I l="Name" v={f.name} on={(x) => set({ ...f, name: x })} req cs={2} />
        <I l="License plate" v={f.plate} on={(x) => set({ ...f, plate: x })} />
        <I l="Capacity" v={String(f.capacity)} on={(x) => set({ ...f, capacity: Number(x) || 0 })} type="number" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Type</span>
          <select value={f.vehicle_type} onChange={(e) => set({ ...f, vehicle_type: e.target.value as any })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            <option value="sedan">Sedan</option><option value="suv">SUV</option>
            <option value="van">Van</option><option value="wheelchair_van">Wheelchair van</option>
            <option value="stretcher_van">Stretcher van</option><option value="ambulance">Ambulance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Status</span>
          <select value={f.status} onChange={(e) => set({ ...f, status: e.target.value as any })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option>
          </select>
        </label>
        <div className="col-span-2 border border-border rounded-sm p-3">
          <div className="font-bold text-sm mb-2">Service capabilities</div>
          <div className="flex flex-wrap gap-3 text-xs">
            {SERVICE_CAPABILITIES.map(c => (
              <label key={c.value} className="flex items-center gap-1.5">
                <input type="checkbox" checked={f.service_capabilities.includes(c.value)}
                       onChange={() => toggleCap(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            What this vehicle can transport. Combine as needed (e.g. wheelchair-accessible van that also handles ambulatory riders).
          </p>
        </div>
        <div className="col-span-2 flex justify-end gap-2 pt-2">

          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <button disabled={m.isPending} className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function I({ l, v, on, type = "text", req, cs }: { l: string; v: string; on: (v: string) => void; type?: string; req?: boolean; cs?: number }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${cs === 2 ? "col-span-2" : ""}`}>
      <span className="font-bold">{l}{req && " *"}</span>
      <input required={req} type={type} value={v} onChange={(e) => on(e.target.value)}
             className="border border-border rounded-sm px-3 py-2 bg-background" />
    </label>
  );
}

function MoneyI({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-bold">{l}</span>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">$</span>
        <input type="number" min={0} step="0.01" value={v} onChange={(e) => on(e.target.value)}
               placeholder="0.00"
               className="w-full border border-border rounded-sm px-2 py-1 bg-background" />
      </div>
    </label>
  );
}


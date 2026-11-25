import { DriverScheduleBase } from '@/components/portal/DriverScheduleBase';
import {useRecordEditAccess} from '@/components/portal/use-record-edit-access';
import { validEmail } from '@/lib/driver-assignment-notice';
import { DetailSection } from '@/components/portal/DetailSection';
import { DetailOverlayFrame } from '@/components/portal/DetailOverlayFrame';
import { useState } from "react";
import { X } from 'lucide-react';
import { DsButton,DsSelect,DsField } from '@/components/ds/controls';
import {RegionalAddressFields} from '@/components/forms/RegionalAddressFields';
import {US_TIMEZONES,serviceAreaSchema} from '@/lib/us-geography';
import {RegionalAreaEditor,emptyAreaSettings,type AreaSettings} from '@/components/forms/RegionalAreaEditor';
import { useDetailWindow } from '@/components/portal/use-detail-window';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import {
  listDrivers, upsertDriver,
  listVehicles, upsertVehicle,
  sendDriverWeeklySchedule,
} from "@/lib/fleet.functions";
import { vehicleCategories } from '@/lib/pass4p-rules';
import {getVehicleForEditing} from '@/lib/fleet.functions';
import {vehicleMissingFields} from '@/lib/provider-operations-rules';
import {StatusPill} from '@/components/ds/status';
import {listMyCredentials} from '@/lib/medicaid.functions';
import { FleetStatusControl, FleetFilterBar, useFleetFilter, applyFleetFilter } from "@/components/portal/FleetStatusControl";

export function FleetPanel({ only, primaryOnly=false }: { only?: "drivers" | "vehicles"; primaryOnly?:boolean } = {}) {
  if (only === "drivers") return <DriversCard />;
  if (only === "vehicles") return <VehiclesCard primaryOnly={primaryOnly} />;
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-2">
      <DriversCard />
      <VehiclesCard />
    </div>
  );
}

function DriversCard() {
  const canEdit=useRecordEditAccess('drivers');
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["drivers"], queryFn: () => listDrivers() });
  const vq = usePortalQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const [editing, setEditing] = useState<any>(null);
  const [scheduling, setScheduling] = useState<any>(null);
  const [filter, setFilter] = useFleetFilter();
  const rows = applyFleetFilter((q.data ?? []) as any[], filter, (d: any) => `${d.first_name} ${d.last_name} ${d.phone ?? ""} ${d.email ?? ""}`);

  return (
    <section className="portal-business-section portal-fleet-card min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
        <h2 className="text-lg font-extrabold tracking-tight">Drivers</h2>
        <DsButton variant="ghost" size="sm" onClick={() => setEditing({ status: "active" })}>+ Add driver</DsButton>
      </div>
      {q.isError ? <div role="alert" className="ds-support text-ds-error">Drivers couldn't load. <button onClick={() => q.refetch()} className="underline">Try again</button></div>
       : q.isLoading ? <p className="text-muted-foreground text-sm">Loading…</p>
       : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No drivers yet.</p>
       : (<>
        <FleetFilterBar value={filter} onChange={setFilter} noun="drivers" />
        {rows.length === 0 && <p className="ds-support">No drivers match these filters.</p>}
        <ul className="divide-y divide-border text-sm">
          {rows.map((d: any) => {
            const veh = (vq.data ?? []).find((v: any) => v.id === d.primary_vehicle_id);
            return (
            <li key={d.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 break-words">
                <div className="font-bold">{d.first_name} {d.last_name}
                  <span className="ds-caption ml-2 rounded-ds bg-ds-sky px-2 py-1 text-ds-primary">{d.employment_type==='independent_contractor'?'Independent Contractor':'Company Driver'}</span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">{String(d.status ?? "Not set").replace("_"," ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">{d.phone}{d.license_expiry ? ` · lic exp ${d.license_expiry}` : ""}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {availabilitySummary(d.availability)}
                </div>
                {(d.service_capabilities?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Services: {(d.service_capabilities as string[]).map(capLabel).join(", ")}
                  </div>
                )}
                {d.vacation_start && d.vacation_end && (
                  <div className="text-[11px] font-bold text-accent-foreground bg-accent/30 inline-block rounded-sm px-1.5 py-0.5 mt-0.5">
                    Vacation: {d.vacation_start} → {d.vacation_end}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Boundary: {d.regional_service_areas?.areas?.map((a:any)=>[a.state,a.countyEquivalent,a.locality,a.postalCode,a.region].filter(Boolean).join(' / ')).join('; ')||'No optional boundary'}<br/>Vehicle: {veh ? `${veh.name}${veh.plate ? ` (${veh.plate})` : ""}` : "unassigned"}
                </div>
                {d.employment_type === "independent_contractor" && pricingSummary(d.contractor_pricing) && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Pricing: <span className="portal-money">{pricingSummary(d.contractor_pricing)}</span>
                  </div>
                )}
              </div>
              <div className="text-xs flex flex-wrap items-center gap-3">
                {canEdit(d.id)&&<DsButton variant="ghost" size="sm" onClick={() => setEditing(d)}>Edit</DsButton>}
                {canEdit(d.id)&&<FleetStatusControl kind="driver" id={d.id} status={d.status} name={`${d.first_name} ${d.last_name}`} />}
              </div>
            </li>
            );
          })}
        </ul></>
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

function DriverDialog({ d, vehicles, onClose, onSaved }: { d: any; vehicles: any[]; onClose: () => void; onSaved: () => void }) {
  const preview = usePortalPreview();
  const detailWindow = useDetailWindow();
  const [boundaries,setBoundaries]=useState<AreaSettings>(()=>{const p=serviceAreaSchema.safeParse(d.regional_service_areas);return p.success?p.data:emptyAreaSettings();});
  const initialAvail = d.availability && typeof d.availability === "object"
    ? { mode: (d.availability.mode ?? "weekly") as "weekly" | "flexible", days: d.availability.days ?? {} }
    : defaultAvailability();
  const initialPricing = d.contractor_pricing && typeof d.contractor_pricing === "object" ? d.contractor_pricing : {};
  const [f, set] = useState({
    regional_state:d.regional_service_areas?.areas?.[0]?.state??'',regional_zip:d.regional_service_areas?.areas?.[0]?.postalCode??'',regional_county:d.regional_service_areas?.areas?.[0]?.countyEquivalent??'',regional_timezone:d.regional_service_areas?.areas?.[0]?.timezone??'',
    first_name: d.first_name ?? "", last_name: d.last_name ?? "",
    phone: d.phone ?? "", email: d.email ?? "", assignment_email_enabled: Boolean(d.assignment_email_enabled), assignment_sms_enabled: Boolean(d.assignment_sms_enabled),
    license_number: d.license_number ?? "", license_expiry: d.license_expiry ?? "",
    status: d.status ?? "active", notes: d.notes ?? "",
    employment_type: d.employment_type ?? "",
    pay_type: d.pay_type ?? "",
    availability: initialAvail,
    service_capabilities: (d.service_capabilities ?? []) as Array<"ambulatory" | "wheelchair" | "stretcher">,
    primary_vehicle_id: (d.primary_vehicle_id ?? "") as string,
    vacation_start: (d.vacation_start ?? "") as string,
    vacation_end: (d.vacation_end ?? "") as string,
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
  const m = usePortalMutation({
    mutationFn: () => upsertDriver({ data: {
      regional_service_areas:boundaries,
      id: d.id,
      first_name: f.first_name,
      last_name: f.last_name,
      phone: f.phone,
      email: f.email,
      assignment_email_enabled: f.assignment_email_enabled, assignment_sms_enabled: f.assignment_sms_enabled,
      license_number: f.license_number,
      license_expiry: f.license_expiry || null,
      status: f.status,
      notes: f.notes,
      employment_type: (f.employment_type || null) as any,
      pay_type: (f.pay_type || null) as any,
      availability: f.availability,
      service_capabilities: f.service_capabilities,
      primary_vehicle_id: f.primary_vehicle_id || null,
      vacation_start: f.vacation_start || null,
      vacation_end: f.vacation_end || null,
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
    <DetailOverlayFrame title={d.id ? preview.active ? 'Driver details — preview only' : 'Edit driver' : 'New driver'} idLabel={d.mfn_id} onClose={onClose}>
      {d.id && <DetailSection title="Driver summary"><dl className="grid gap-3 sm:grid-cols-2">{[
        ['Name / MFN ID', `${d.first_name} ${d.last_name} · ${d.mfn_id ?? 'Not Available'}`], ['Classification', employmentLabel(d.employment_type)], ['Contact', [d.phone,d.email].filter(Boolean).join(' · ') || 'Not Provided'], ['Assignment emails', d.assignment_email_enabled ? (validEmail(d.email) ? 'Driver opted in' : 'No email') : 'Off'], ['SMS notices',d.assignment_sms_enabled?'Driver opted in':'Off'], ['Availability', availabilitySummary(d.availability)], ['Assigned vehicle', vehicles.find(v=>v.id===d.primary_vehicle_id)?.name ?? 'Not assigned'], ['Supported services', (d.service_capabilities??[]).map(capLabel).join(', ') || 'Not Provided'], ['Credentials', d.credential_status ?? 'Not Available — review required'], ['Status', d.status ?? 'Not Provided'], ['Earnings', 'Available in authorized Earnings & Payments only'],
      ].map(([label,value])=><div key={label} className="min-w-0 rounded-ds-sm bg-ds-bg p-3"><dt className="ds-label font-bold text-ds-primary">{label}</dt><dd className="ds-body break-words">{value}</dd></div>)}</dl></DetailSection>}
      <form onSubmit={(e) => { e.preventDefault(); if (!preview.active) m.mutate(); }} className="portal-business-form grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <section className="portal-dialog-section sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <I l="First name" v={f.first_name} on={(v) => set({ ...f, first_name: v })} req />
        <I l="Last name" v={f.last_name} on={(v) => set({ ...f, last_name: v })} req />
        <I l="Phone" v={f.phone} on={(v) => set({ ...f, phone: v })} />
        <I l="Email" v={f.email} on={(v) => set({ ...f, email: v })} type="email" />
        {d.id&&<DriverScheduleBase driverId={d.id}/>}
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.assignment_sms_enabled} onChange={e=>set({...f,assignment_sms_enabled:e.target.checked})}/><span><span className="font-bold text-ds-primary">SMS schedule notices — driver consent</span><span className="block ds-caption">Requires the driver's explicit consent and a saved international-format phone number. Business consent and configured service are also required; live delivery remains off.</span></span></label>
        <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.assignment_email_enabled} onChange={(e) => set({ ...f, assignment_email_enabled: e.target.checked })} /><span><span className="font-bold text-ds-primary">Email assignment notices</span><span className="block ds-caption">Sends only when the business switch in Settings is also on and this driver has a valid email. {f.email && !validEmail(f.email) ? 'Email looks invalid.' : ''}</span></span></label>
        <I l="License #" v={f.license_number} on={(v) => set({ ...f, license_number: v })} />
        <I l="License expiry" v={f.license_expiry} on={(v) => set({ ...f, license_expiry: v })} type="date" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ds-primary">Status</span>
          <select value={f.status} onChange={(e) => set({ ...f, status: e.target.value as any })}
                  className="portal-input min-w-0">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ds-primary">Employment type</span>
          <select value={f.employment_type} onChange={(e) => set({ ...f, employment_type: e.target.value })}
                  className="portal-input min-w-0">
            {EMPLOYMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        </section>
        <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3 bg-background/60">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="font-bold text-sm">Vacation mode</span>
            <span className="text-[11px] text-muted-foreground">
              While active, this driver is hidden from the schedule board and cannot be assigned new trips.
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            <I l="Vacation start" v={f.vacation_start} on={(v) => set({ ...f, vacation_start: v })} type="date" />
            <I l="Vacation end" v={f.vacation_end} on={(v) => set({ ...f, vacation_end: v })} type="date" />
          </div>
          {(f.vacation_start || f.vacation_end) && (
            <button type="button" className="mt-2 text-xs font-bold text-primary hover:underline"
                    onClick={() => set({ ...f, vacation_start: "", vacation_end: "" })}>
              Clear vacation dates
            </button>
          )}
        </div>

        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold text-ds-primary">Primary vehicle</span>
          <select value={f.primary_vehicle_id} onChange={(e) => set({ ...f, primary_vehicle_id: e.target.value })}
                  className="portal-input min-w-0">
            <option value="">— None —</option>
            {vehicles.filter((v: any) => v.status === "active" || v.id === f.primary_vehicle_id).map((v: any) => (
              <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ""}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Vehicle this driver primarily operates. Used across scheduling and dispatch. Saving will also update the vehicle's assigned driver.
          </span>
        </label>


        <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
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

        <div className="sm:col-span-2"><RegionalAreaEditor value={boundaries} onChange={setBoundaries}/></div>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold text-ds-primary">Driver pay type</span>
          <select value={f.pay_type} onChange={(e) => set({ ...f, pay_type: e.target.value })}
                  className="portal-input min-w-0">
            {PAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Choose one: Hourly, Daily Salary, or Independent Contractor (1099). Only the fields for the selected pay type are shown.
          </span>
        </label>

        {isHourly && (
          <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
            <div className="font-bold text-sm mb-2">Hourly pay</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <MoneyI l="Hourly rate ($ / hour)" v={f.pricing.hourly_rate}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, hourly_rate: v } })} />
            </div>
          </div>
        )}

        {isDaily && (
          <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
            <div className="font-bold text-sm mb-2">Daily salary</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <MoneyI l="Daily pay ($ / day)" v={f.pricing.daily_rate}
                      on={(v) => set({ ...f, pricing: { ...f.pricing, daily_rate: v } })} />
            </div>
          </div>
        )}

        {isContractor && !isHourly && !isDaily && (
          <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
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
                <span className="font-bold text-ds-primary">Pricing notes</span>
                <textarea rows={2} value={f.pricing.notes}
                          onChange={(e) => set({ ...f, pricing: { ...f.pricing, notes: e.target.value } })}
                          className="border border-border rounded-sm px-2 py-1 bg-background" />
              </label>
            </div>
          </div>
        )}



        <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
          <div className="grid min-w-0 gap-2 mb-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <span className="font-bold text-sm">Weekly availability</span>
            <label className="flex items-center gap-2 text-xs">
              <span className="font-bold text-ds-primary">Mode</span>
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
                  <div key={k} className="grid min-w-0 grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2 text-xs sm:grid-cols-[2.5rem_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                    <span className="w-10 font-bold text-ds-primary">{label}</span>
                    <label className="flex items-center gap-1">
                      <input type="checkbox" checked={off} onChange={(e) => setDay(k, { off: e.target.checked })} />
                      <span>Off</span>
                    </label>
                    <input type="time" step={300} disabled={off} value={day.start ?? "09:00"}
                           onChange={(e) => setDay(k, { start: e.target.value })}
                           className="portal-input min-w-0 w-full disabled:opacity-40" />
                    <span>–</span>
                    <input type="time" step={300} disabled={off} value={day.end ?? "17:00"}
                           onChange={(e) => setDay(k, { end: e.target.value })}
                           className="portal-input min-w-0 w-full disabled:opacity-40" />
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

        <div className="portal-dialog-actions sm:col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <DsButton disabled={preview.active || m.isPending} type="submit">{preview.active ? "Save unavailable in preview" : m.isPending ? "Saving…" : "Save"}</DsButton>
        </div>
      </form>
    </DetailOverlayFrame>
  );
}

function WeekScheduleDialog({ d, onClose }: { d: any; onClose: () => void }) {
  const today = new Date();
  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const [weekStart, setWeekStart] = useState(monday.toISOString().slice(0, 10));
  const m = usePortalMutation({
    mutationFn: () => sendDriverWeeklySchedule({ data: { driver_id: d.id, week_start: weekStart } }),
    onSuccess: (r: any) => { toast.success(`Schedule queued — ${r.count} trip${r.count === 1 ? "" : "s"}`); onClose(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to send"),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="portal-custom-dialog bg-card rounded-sm max-w-sm w-full p-6 grid gap-3">
        <h3 className="text-lg font-extrabold">Email week schedule</h3>
        <p className="text-sm text-muted-foreground">
          Send {d.first_name} {d.last_name} a 7-day trip schedule starting on the date below.
        </p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ds-primary">Week start</span>
          <input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} required
                 className="portal-input min-w-0" />
        </label>
        <div className="text-xs text-muted-foreground">To: {d.email}</div>
        <div className="portal-dialog-actions flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <button disabled={m.isPending} className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm disabled:opacity-50">
            {m.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VehiclesCard({primaryOnly=false}:{primaryOnly?:boolean}) {
  const canEdit=useRecordEditAccess('vehicles');
  const preview=usePortalPreview();
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["vehicles"], queryFn: () => listVehicles() });
  const dq = usePortalQuery({ queryKey: ["drivers"], queryFn: () => listDrivers() });
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useFleetFilter();
  const rows = applyFleetFilter((q.data ?? []) as any[], filter, (v: any) => `${v.name} ${v.plate ?? ""} ${v.vehicle_type ?? ""}`);
  return (
    <section className="portal-business-section portal-fleet-card min-w-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3">
        <h2 className="text-lg font-extrabold tracking-tight">{primaryOnly?'Primary ambulatory vehicle':'Vehicles'}</h2>
        <DsButton variant="ghost" size="sm" onClick={() => setEditing({ vehicle_type: "sedan", status: "active",...(primaryOnly?{vehicle_category:'ambulatory',service_capabilities:['ambulatory']}:{} ) })}>+ Add vehicle</DsButton>
      </div>
      {q.isError ? <div role="alert" className="ds-support text-ds-error">Vehicles couldn't load. <button onClick={() => q.refetch()} className="underline">Try again</button></div>
       : q.isLoading ? <p className="text-muted-foreground text-sm">Loading…</p>
       : (q.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No vehicles yet.</p>
       : (<>
        <FleetFilterBar value={filter} onChange={setFilter} noun="vehicles" />
        {rows.length === 0 && <p className="ds-support">No vehicles match these filters.</p>}
        <ul className="divide-y divide-border text-sm">
          {rows.map((v: any) => {
            const drv = (dq.data ?? []).find((d: any) => d.id === v.assigned_driver_id);
            return (
            <li key={v.id} className="py-2 flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0 break-words">
                <div className="font-bold">{v.name}
                  <span className="ml-2 text-xs uppercase text-muted-foreground">{String(v.vehicle_type ?? v.type ?? "Not set").replace("_"," ")}</span>
                </div>
                <p className="ds-support">{[v.make,v.model,v.model_year].filter(Boolean).join(' ')||'Make / model / year not recorded'}</p>
                {vehicleMissingFields(v).length>0&&<p className="ds-caption mt-1"><StatusPill status="Incomplete" tone="yellow"/> Missing: {vehicleMissingFields(v).join(', ')}</p>}
                <div className="text-xs text-muted-foreground">{v.plate || "Plate not recorded"} · {v.capacity ?? 'Not recorded'} seats · {v.wheelchair_capacity ?? 'Not recorded'} wheelchair positions · {v.status ?? "Not set"}</div>
                <p className="ds-caption mt-1">VIN: {v.masked_vin??'Not recorded'} · Insurance expiry: {v.insurance_expiry??'Missing'}</p>
                {(v.service_capabilities?.length ?? 0) > 0 && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Services: {(v.service_capabilities as string[]).map(capLabel).join(", ")}
                  </div>
                )}
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Driver: {drv ? `${drv.first_name} ${drv.last_name}` : "unassigned"}
                </div>
              </div>
              <div className="text-xs flex flex-wrap items-center gap-3">
                <DsButton variant="ghost" size="sm" disabled={!canEdit(v.id)} onClick={async()=>{if(!v.id||!canEdit(v.id))return;if(preview.active){setEditing({...v,vin:''});return;}try{setEditing(await getVehicleForEditing({data:{id:v.id}}));}catch{toast.error('Authorized vehicle editing required.');}}}>{canEdit(v.id)?'Edit':'Read only'}</DsButton>
                {canEdit(v.id)&&<FleetStatusControl kind="vehicle" id={v.id} status={v.status} name={v.name} />}
              </div>
            </li>
            );
          })}
        </ul></>
      )}
      {editing && <VehicleDialog v={editing} drivers={dq.data ?? []} onClose={() => setEditing(null)}
                                 onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["vehicles"] }); qc.invalidateQueries({ queryKey: ["drivers"] }); }} />}
    </section>
  );
}

function VehicleDialog({ v, drivers, onClose, onSaved }: { v: any; drivers: any[]; onClose: () => void; onSaved: () => void }) {
  const preview = usePortalPreview();
  const [boundaries,setBoundaries]=useState<AreaSettings>(()=>{const p=serviceAreaSchema.safeParse(v.regional_service_areas);return p.success?p.data:emptyAreaSettings();});
  const docs=usePortalQuery({queryKey:['my-credentials'],queryFn:()=>listMyCredentials()});
  const [f, set] = useState({
    name: v.name ?? "", plate: v.plate ?? "", make:v.make ?? "",model:v.model ?? "",model_year:v.model_year ?? "",vehicle_category:v.vehicle_category ?? "",accessibility_equipment:v.accessibility_equipment ?? "",
    vehicle_type: v.vehicle_type ?? "sedan",
    capacity: v.capacity ?? '', wheelchair_capacity: v.wheelchair_capacity ?? '', status: v.status ?? "active", notes: v.notes ?? "",
    service_capabilities: (v.service_capabilities ?? []) as Array<"ambulatory" | "wheelchair" | "stretcher">,
    assigned_driver_id: (v.assigned_driver_id ?? "") as string,
    service_states:(v.service_states??[]).join(', '),operating_timezone:v.operating_timezone??'',vin:v.vin??'',insurance_credential_id:v.insurance_credential_id??null,insurance_expiry:v.insurance_expiry??'',service_regions:(v.service_regions??[]).join(', '),service_counties:(v.service_counties??[]).join(', '),service_cities:(v.service_cities??[]).join(', '),service_zips:(v.service_zips??[]).join(', '),travel_radius_miles:v.travel_radius_miles??'',
  });
  const toggleCap = (val: "ambulatory" | "wheelchair" | "stretcher") =>
    set({ ...f, service_capabilities: f.service_capabilities.includes(val)
      ? f.service_capabilities.filter(x => x !== val)
      : [...f.service_capabilities, val] });
  const m = usePortalMutation({
    mutationFn: () => upsertVehicle({ data: { ...f,regional_service_areas:boundaries,service_states:f.service_states.split(',').map((s:string)=>s.trim().toUpperCase()).filter(Boolean), id: v.id, model_year:Number(f.model_year), capacity: Number(f.capacity), insurance_expiry:f.insurance_expiry||null,travel_radius_miles:f.travel_radius_miles===''?null:Number(f.travel_radius_miles),service_regions:f.service_regions.split(',').map((s:string)=>s.trim()).filter(Boolean),service_counties:f.service_counties.split(',').map((s:string)=>s.trim()).filter(Boolean),service_cities:f.service_cities.split(',').map((s:string)=>s.trim()).filter(Boolean),service_zips:f.service_zips.split(',').map((s:string)=>s.trim()).filter(Boolean),assigned_driver_id: f.assigned_driver_id || null } as any }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  return (
    <DetailOverlayFrame title={v.id ? preview.active ? 'Vehicle details — preview only' : 'Edit vehicle' : 'New vehicle'} onClose={onClose}>
      {v.id && <DetailSection title="Vehicle summary"><dl className="grid gap-3 sm:grid-cols-2">{[
        ['Custom name', v.name], ['Make / model / year', [v.make,v.model,v.model_year].filter(Boolean).join(' ')], ['VIN', v.masked_vin ?? 'Not Provided'], ['License plate', v.plate], ['Category', v.vehicle_category], ['Capacity', `${v.capacity ?? 'Not Provided'} passengers · ${v.wheelchair_capacity ?? 'Not Provided'} wheelchair positions`], ['Accessibility equipment', v.accessibility_equipment ?? 'Not Provided'], ['Services', (v.service_capabilities??[]).map(capLabel).join(', ')], ['Insurance / documents', `${v.evidence_status ?? 'Review required'} · expiry ${v.insurance_expiry ?? 'Not Provided'}`], ['Assigned driver', drivers.find(d=>d.id===v.assigned_driver_id)?.first_name ?? 'Not assigned'], ['Service boundary', v.regional_service_areas?.areas?.map((a:any)=>[a.state,a.countyEquivalent,a.locality,a.postalCode,a.region].filter(Boolean).join(' / ')).join('; ') || 'No optional boundary'], ['Status', v.status], ['History', v.notes || 'No history supplied'],
      ].map(([label,value])=><div key={label} className="min-w-0 rounded-ds-sm bg-ds-bg p-3"><dt className="ds-label font-bold text-ds-primary">{label}</dt><dd className="ds-body break-words">{value || 'Not Provided'}</dd></div>)}</dl></DetailSection>}
      <form onSubmit={(e) => { e.preventDefault(); if (!preview.active) m.mutate(); }} className="portal-business-form grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <I l="Custom vehicle name" v={f.name} on={(x) => set({ ...f, name: x })} req cs={2} />
        <I l="Full VIN — authorized editing only" v={f.vin} on={x=>set({...f,vin:x.toUpperCase()})}/><I l="Vehicle insurance expiration" type="date" v={f.insurance_expiry} on={x=>set({...f,insurance_expiry:x})}/>
        <label className="flex flex-col gap-1 ds-body sm:col-span-2"><span className="ds-label">Private vehicle insurance record</span><select value={f.insurance_credential_id??''} onChange={e=>{const doc=docs.data?.find(d=>d.id===e.target.value);set({...f,insurance_credential_id:e.target.value||null,insurance_expiry:doc?.expires_at??f.insurance_expiry});}}><option value="">No insurance evidence linked</option>{(docs.data??[]).filter(d=>d.workspace_id===v.workspace_id&&d.kind==='auto_insurance').map(d=><option key={d.id} value={d.id}>{d.label} · {d.expires_at??'Expiry not recorded'}</option>)}</select><span className="ds-caption">Add private insurance evidence in Settings → Credentials & Documents, then link it here. Upload presence does not establish legal sufficiency.</span></label>
        <I l="States served (two-letter codes, comma separated)" v={f.service_states} on={x=>set({...f,service_states:x})}/><DsField label="Vehicle operating timezone">{p=><DsSelect {...p} value={f.operating_timezone} onChange={e=>set({...f,operating_timezone:e.target.value})}><option value="">Unknown — review required</option>{US_TIMEZONES.map(z=><option key={z} value={z}>{z}</option>)}</DsSelect>}</DsField><I l="Service regions (comma separated)" v={f.service_regions} on={x=>set({...f,service_regions:x})}/><I l="Counties (comma separated)" v={f.service_counties} on={x=>set({...f,service_counties:x})}/><I l="Cities (comma separated)" v={f.service_cities} on={x=>set({...f,service_cities:x})}/><I l="ZIP codes (comma separated)" v={f.service_zips} on={x=>set({...f,service_zips:x})}/><I l="Travel radius (miles)" type="number" v={String(f.travel_radius_miles)} on={x=>set({...f,travel_radius_miles:x})}/>
        <div className="sm:col-span-2"><RegionalAreaEditor value={boundaries} onChange={setBoundaries}/></div>
        <I l="Make" v={f.make} on={x=>set({...f,make:x})} req/><I l="Model" v={f.model} on={x=>set({...f,model:x})} req/><I l="Year" v={String(f.model_year)} on={x=>set({...f,model_year:x})} type="number" req/><I l="License plate" v={f.plate} on={(x) => set({ ...f, plate: x })} req />
        <label className="flex flex-col gap-1 ds-body"><span className="ds-label">Vehicle category</span><select required value={f.vehicle_category} onChange={e=>set({...f,vehicle_category:e.target.value})}><option value="">Choose category</option>{vehicleCategories.map(c=><option key={c.value} value={c.value}>{c.label}</option>)}</select></label><I l="Accessibility equipment" v={f.accessibility_equipment} on={x=>set({...f,accessibility_equipment:x})}/><p className="ds-support sm:col-span-2">Evidence: {v.evidence_status==='satisfied'?'Requirement Satisfied':v.evidence_status==='expired'?'Expired':'Under Review / Unable to Validate'}. Vehicle details do not verify documents.</p>
        <I l="Capacity" v={String(f.capacity)} on={(x) => set({ ...f, capacity: Number(x) || 0 })} type="number" />
        <I l="Wheelchair positions" v={String(f.wheelchair_capacity)} on={(x) => set({ ...f, wheelchair_capacity: Math.max(0, Number(x) || 0) })} type="number" />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ds-primary">Type</span>
          <select value={f.vehicle_type} onChange={(e) => set({ ...f, vehicle_type: e.target.value as any })}
                  className="portal-input min-w-0">
            <option value="sedan">Sedan</option><option value="suv">SUV</option>
            <option value="van">Van</option><option value="wheelchair_van">Wheelchair van</option>
            <option value="stretcher_van">Stretcher van</option><option value="ambulance">Ambulance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold text-ds-primary">Status</span>
          <select value={f.status} onChange={(e) => set({ ...f, status: e.target.value as any })}
                  className="portal-input min-w-0">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="maintenance">Maintenance</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold text-ds-primary">Primary driver</span>
          <select value={f.assigned_driver_id} onChange={(e) => set({ ...f, assigned_driver_id: e.target.value })}
                  className="portal-input min-w-0">
            <option value="">— None —</option>
            {drivers.filter((d: any) => (!v.workspace_id||d.workspace_id===v.workspace_id)&&(d.status === "active" || d.id === f.assigned_driver_id)).map((d: any) => (
              <option key={d.id} value={d.id}>{d.first_name} {d.last_name}</option>
            ))}
          </select>
          <span className="text-[11px] text-muted-foreground">
            Driver primarily assigned to this vehicle. Used across scheduling and dispatch. Saving will also update the driver's primary vehicle.
          </span>
        </label>
        <div className="portal-dialog-section sm:col-span-2 border border-border rounded-sm p-3">
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
        <div className="portal-dialog-actions sm:col-span-2 flex justify-end gap-2 pt-2">

          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground">Cancel</button>
          <DsButton disabled={preview.active || m.isPending} type="submit">{preview.active ? "Save unavailable in preview" : m.isPending ? "Saving…" : "Save"}</DsButton>
        </div>
      </form>
    </DetailOverlayFrame>
  );
}

function I({ l, v, on, type = "text", req, cs }: { l: string; v: string; on: (v: string) => void; type?: string; req?: boolean; cs?: number }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${cs === 2 ? "sm:col-span-2" : ""}`}>
      <span className="font-bold text-ds-primary">{l}{req && " *"}</span>
      <input required={req} type={type} value={v} onChange={(e) => on(e.target.value)}
             className="portal-input min-w-0" />
    </label>
  );
}

function MoneyI({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-bold text-ds-primary">{l}</span>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">$</span>
        <input type="number" min={0} step="0.01" value={v} onChange={(e) => on(e.target.value)}
               placeholder="0.00"
               className="portal-money-input w-full border border-border rounded-sm px-2 py-1 bg-background" />
      </div>
    </label>
  );
}


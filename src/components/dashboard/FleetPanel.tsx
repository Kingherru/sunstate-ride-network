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
  const [editing, setEditing] = useState<any>(null);
  const [scheduling, setScheduling] = useState<any>(null);
  const del = useMutation({
    mutationFn: (id: string) => deleteDriver({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["drivers"] }); },
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
          {q.data!.map((d: any) => (
            <li key={d.id} className="py-2 flex items-center justify-between">
              <div>
                <div className="font-bold">{d.first_name} {d.last_name}
                  <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">{d.status.replace("_"," ")}</span>
                </div>
                <div className="text-xs text-muted-foreground">{d.phone}{d.license_expiry ? ` · lic exp ${d.license_expiry}` : ""}</div>
              </div>
              <div className="text-xs flex items-center gap-3">
                {d.email && (
                  <button onClick={() => setScheduling(d)} className="font-bold text-primary hover:underline">Email week</button>
                )}
                <button onClick={() => setEditing(d)} className="font-bold text-primary hover:underline">Edit</button>
                <button onClick={() => confirm("Remove driver?") && del.mutate(d.id)} className="font-bold text-red-600 hover:underline">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing && <DriverDialog d={editing} onClose={() => setEditing(null)}
                                onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["drivers"] }); }} />}
      {scheduling && <WeekScheduleDialog d={scheduling} onClose={() => setScheduling(null)} />}
    </section>
  );
}

function DriverDialog({ d, onClose, onSaved }: { d: any; onClose: () => void; onSaved: () => void }) {
  const [f, set] = useState({
    first_name: d.first_name ?? "", last_name: d.last_name ?? "",
    phone: d.phone ?? "", email: d.email ?? "",
    license_number: d.license_number ?? "", license_expiry: d.license_expiry ?? "",
    status: d.status ?? "active", notes: d.notes ?? "",
  });
  const m = useMutation({
    mutationFn: () => upsertDriver({ data: { ...f, id: d.id, license_expiry: f.license_expiry || null } as any }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-lg w-full p-6 grid grid-cols-2 gap-3">
        <h3 className="col-span-2 text-lg font-extrabold">{d.id ? "Edit driver" : "New driver"}</h3>
        <I l="First name" v={f.first_name} on={(v) => set({ ...f, first_name: v })} req />
        <I l="Last name" v={f.last_name} on={(v) => set({ ...f, last_name: v })} req />
        <I l="Phone" v={f.phone} on={(v) => set({ ...f, phone: v })} />
        <I l="Email" v={f.email} on={(v) => set({ ...f, email: v })} type="email" />
        <I l="License #" v={f.license_number} on={(v) => set({ ...f, license_number: v })} />
        <I l="License expiry" v={f.license_expiry} on={(v) => set({ ...f, license_expiry: v })} type="date" />
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-bold">Status</span>
          <select value={f.status} onChange={(e) => set({ ...f, status: e.target.value as any })}
                  className="border border-border rounded-sm px-3 py-2 bg-background">
            <option value="active">Active</option><option value="inactive">Inactive</option><option value="on_leave">On leave</option>
          </select>
        </label>
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
  });
  const m = useMutation({
    mutationFn: () => upsertVehicle({ data: { ...f, id: v.id, capacity: Number(f.capacity) } as any }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-lg w-full p-6 grid grid-cols-2 gap-3">
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

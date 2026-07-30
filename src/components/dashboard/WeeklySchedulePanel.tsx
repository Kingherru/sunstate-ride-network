import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listMySchedule,
  upsertScheduleEntry,
  deleteScheduleEntry,
} from "@/lib/schedules.functions";

function isoMonday(d: Date) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Monday=0
  x.setDate(x.getDate() - day);
  return x.toISOString().slice(0, 10);
}

const empty = {
  pickup_date: "",
  pickup_time: "",
  dropoff_time: "",
  pickup_address: "",
  dropoff_address: "",
  round_trip: false,
  passenger_first_name: "",
  passenger_last_name: "",
  passenger_phone: "",
  notes: "",
};

export function WeeklySchedulePanel() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState<string>(isoMonday(new Date()));
  const [form, setForm] = useState<any>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const listFn = useServerFn(listMySchedule);
  const upsertFn = useServerFn(upsertScheduleEntry);
  const delFn = useServerFn(deleteScheduleEntry);

  const q = useQuery({
    queryKey: ["schedule", weekStart],
    queryFn: () => listFn({ data: { week_start: weekStart } }),
  });

  const mUpsert = useMutation({
    mutationFn: (data: any) => upsertFn({ data }),
    onSuccess: () => {
      toast.success(editingId ? "Entry updated" : "Entry added");
      setForm(empty);
      setEditingId(null);
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const mDel = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Entry removed");
      qc.invalidateQueries({ queryKey: ["schedule"] });
    },
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...(editingId ? { id: editingId } : {}),
      week_start: weekStart,
      pickup_date: form.pickup_date,
      pickup_time: form.pickup_time,
      dropoff_time: form.dropoff_time || null,
      pickup_address: form.pickup_address,
      dropoff_address: form.dropoff_address,
      round_trip: !!form.round_trip,
      passenger_first_name: form.passenger_first_name,
      passenger_last_name: form.passenger_last_name,
      passenger_phone: form.passenger_phone || null,
      notes: form.notes || null,
    };
    mUpsert.mutate(payload);
  }

  const entries = q.data ?? [];
  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    entries.forEach((e: any) => {
      if (!map.has(e.pickup_date)) map.set(e.pickup_date, []);
      map.get(e.pickup_date)!.push(e);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Weekly Schedule</h2>
        <p className="text-sm text-muted-foreground">
          Submit and manage your weekly trip schedule.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-semibold">Week starting</label>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeekStart(e.target.value)}
          className="bg-card border border-border rounded-sm px-3 py-2 text-sm"
        />
        <span className="text-xs text-muted-foreground">{entries.length} entries</span>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-4 text-sm font-bold">{editingId ? "Edit entry" : "Add entry"}</div>
        <Field label="Pickup date">
          <input type="date" required value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} className="input" />
        </Field>
        <Field label="Pickup time">
          <input type="time" step={300} required value={form.pickup_time} onChange={(e) => setForm({ ...form, pickup_time: e.target.value })} className="input" />
        </Field>
        <Field label="Drop-off time">
          <input type="time" step={300} value={form.dropoff_time} onChange={(e) => setForm({ ...form, dropoff_time: e.target.value })} className="input" />
        </Field>
        <Field label="Round trip">
          <div className="h-9 flex items-center">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.round_trip} onChange={(e) => setForm({ ...form, round_trip: e.target.checked })} />
              Yes
            </label>
          </div>
        </Field>
        <Field label="Pickup address" span={2}>
          <input required value={form.pickup_address} onChange={(e) => setForm({ ...form, pickup_address: e.target.value })} className="input" />
        </Field>
        <Field label="Drop-off address" span={2}>
          <input required value={form.dropoff_address} onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })} className="input" />
        </Field>
        <Field label="Passenger first name">
          <input required value={form.passenger_first_name} onChange={(e) => setForm({ ...form, passenger_first_name: e.target.value })} className="input" />
        </Field>
        <Field label="Passenger last name">
          <input required value={form.passenger_last_name} onChange={(e) => setForm({ ...form, passenger_last_name: e.target.value })} className="input" />
        </Field>
        <Field label="Passenger phone" span={2}>
          <input value={form.passenger_phone} onChange={(e) => setForm({ ...form, passenger_phone: e.target.value })} className="input" />
        </Field>
        <div className="md:col-span-4 flex gap-2">
          <button
            type="submit"
            disabled={mUpsert.isPending}
            className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-sm"
          >
            {editingId ? "Save changes" : "Add entry"}
          </button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm(empty); }} className="text-sm font-semibold px-4 py-2 border border-border rounded-sm">
              Cancel
            </button>
          )}
        </div>
        <style>{`.input{background:hsl(var(--card));border:1px solid hsl(var(--border));border-radius:2px;padding:.5rem .75rem;font-size:.875rem;width:100%;}`}</style>
      </form>

      {/* List */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {q.isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No entries for this week.</div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([date, rows]) => (
              <div key={date} className="p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {new Date(date + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
                </div>
                <ul className="space-y-2">
                  {rows.map((r: any) => (
                    <li key={r.id} className="flex items-start justify-between gap-4 bg-background/40 border border-border rounded-sm p-3">
                      <div className="text-sm">
                        <div className="font-bold">
                          {String(r.pickup_time).slice(0, 5)}
                          {r.dropoff_time ? ` → ${String(r.dropoff_time).slice(0, 5)}` : ""}
                          {r.round_trip ? <span className="ml-2 text-xs font-bold text-accent">ROUND TRIP</span> : <span className="ml-2 text-xs font-semibold text-muted-foreground">One-way</span>}
                        </div>
                        <div className="mt-1">{r.passenger_first_name} {r.passenger_last_name}{r.passenger_phone ? ` · ${r.passenger_phone}` : ""}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-semibold">Pickup:</span> {r.pickup_address}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-semibold">Drop-off:</span> {r.dropoff_address}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingId(r.id); setForm({ ...r, dropoff_time: r.dropoff_time ?? "", passenger_phone: r.passenger_phone ?? "", notes: r.notes ?? "" }); }}
                          className="text-xs font-bold text-primary hover:underline"
                        >Edit</button>
                        <button
                          onClick={() => { if (confirm("Remove this entry?")) mDel.mutate(r.id); }}
                          className="text-xs font-bold text-red-600 hover:underline"
                        >Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, span = 1 }: { label: string; children: React.ReactNode; span?: 1 | 2 }) {
  return (
    <label className={`block ${span === 2 ? "md:col-span-2" : ""}`}>
      <span className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listSavedPatients,
  createSavedPatient,
  updateSavedPatient,
  deleteSavedPatient,
} from "@/lib/saved-patients.functions";

type Patient = Awaited<ReturnType<typeof listSavedPatients>>[number];

const EMPTY = {
  first_name: "", last_name: "", dob: "", phone: "", email: "",
  medicaid_id: "", mobility: "", notes: "",
  default_pickup_address: "", default_pickup_city: "",
  default_dropoff_address: "", default_dropoff_city: "",
};

export function SavedPatientsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-patients"], queryFn: () => listSavedPatients() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["saved-patients"] });

  const createM = useMutation({
    mutationFn: () => createSavedPatient({ data: form as any }),
    onSuccess: () => { toast.success("Patient saved"); setAdding(false); setForm({ ...EMPTY }); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const updateM = useMutation({
    mutationFn: () => updateSavedPatient({ data: { id: editingId!, ...(form as any) } }),
    onSuccess: () => { toast.success("Updated"); setEditingId(null); setForm({ ...EMPTY }); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const delM = useMutation({
    mutationFn: (id: string) => deleteSavedPatient({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  function startEdit(p: Patient) {
    setEditingId(p.id);
    setAdding(false);
    setForm({
      first_name: p.first_name ?? "", last_name: p.last_name ?? "",
      dob: p.dob ?? "", phone: p.phone ?? "", email: p.email ?? "",
      medicaid_id: p.medicaid_id ?? "", mobility: p.mobility ?? "",
      notes: p.notes ?? "",
      default_pickup_address: p.default_pickup_address ?? "",
      default_pickup_city: p.default_pickup_city ?? "",
      default_dropoff_address: p.default_dropoff_address ?? "",
      default_dropoff_city: p.default_dropoff_city ?? "",
    });
  }

  const isEditing = editingId !== null || adding;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Saved patients</h2>
          <p className="text-sm text-muted-foreground">Reuse passenger info when booking — no re-typing.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setForm({ ...EMPTY }); }}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90"
          >
            Add patient
          </button>
        )}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isEditing && (
        <form
          onSubmit={(e) => { e.preventDefault(); (editingId ? updateM : createM).mutate(); }}
          className="bg-card border border-border rounded-sm p-5 space-y-3"
        >
          <h3 className="font-extrabold">{editingId ? "Edit patient" : "New patient"}</h3>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="First name *"><input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Last name *"><input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Date of birth"><input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={inputCls} /></Field>
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            <Field label="Medicaid ID"><input value={form.medicaid_id} onChange={(e) => setForm({ ...form, medicaid_id: e.target.value })} className={inputCls} /></Field>
            <Field label="Mobility (ambulatory, wheelchair, stretcher…)"><input value={form.mobility} onChange={(e) => setForm({ ...form, mobility: e.target.value })} className={inputCls} /></Field>
            <Field label="Default pickup address"><input value={form.default_pickup_address} onChange={(e) => setForm({ ...form, default_pickup_address: e.target.value })} className={inputCls} /></Field>
            <Field label="Default pickup city"><input value={form.default_pickup_city} onChange={(e) => setForm({ ...form, default_pickup_city: e.target.value })} className={inputCls} /></Field>
            <Field label="Default drop-off address"><input value={form.default_dropoff_address} onChange={(e) => setForm({ ...form, default_dropoff_address: e.target.value })} className={inputCls} /></Field>
            <Field label="Default drop-off city"><input value={form.default_dropoff_city} onChange={(e) => setForm({ ...form, default_dropoff_city: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
          <div className="flex gap-2">
            <button type="submit" disabled={createM.isPending || updateM.isPending} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
              {editingId ? (updateM.isPending ? "Saving…" : "Save changes") : (createM.isPending ? "Saving…" : "Save patient")}
            </button>
            <button type="button" onClick={() => { setAdding(false); setEditingId(null); setForm({ ...EMPTY }); }} className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {(q.data ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between border border-border rounded-sm p-3 bg-card">
            <div className="text-sm">
              <div className="font-bold">{p.first_name} {p.last_name}</div>
              <div className="text-muted-foreground text-xs">
                {[p.phone, p.email, p.medicaid_id ? `Medicaid ${p.medicaid_id}` : null, p.mobility].filter(Boolean).join(" • ") || "No contact info"}
              </div>
            </div>
            <div className="flex gap-3 text-sm font-bold">
              <button onClick={() => startEdit(p)} className="text-primary hover:underline">Edit</button>
              <button onClick={() => { if (confirm(`Remove ${p.first_name} ${p.last_name}?`)) delM.mutate(p.id); }} className="text-destructive hover:underline">Remove</button>
            </div>
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && !isEditing && (
          <li className="text-sm text-muted-foreground">No saved patients yet.</li>
        )}
      </ul>
    </div>
  );
}

const inputCls = "w-full border border-border rounded-sm px-3 py-2 bg-background";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

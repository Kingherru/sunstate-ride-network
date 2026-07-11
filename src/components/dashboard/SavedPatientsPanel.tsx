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
type Kind = "patient" | "contact";

const EMPTY = {
  kind: "patient" as Kind,
  first_name: "", last_name: "", dob: "", phone: "", email: "",
  medicaid_id: "", mobility: "", notes: "",
  default_pickup_address: "", default_pickup_city: "",
  default_dropoff_address: "", default_dropoff_city: "",
  // CMS/Medicaid billing
  payer: "", medicaid_number: "", medicaid_plan: "",
  diagnosis_code: "", authorization_number: "",
  // Demographics
  gender: "", address_line1: "", address_line2: "",
  city: "", state: "", zip: "",
};

export function SavedPatientsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["saved-patients"], queryFn: () => listSavedPatients() });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [filter, setFilter] = useState<"all" | Kind>("all");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["saved-patients"] });

  const createM = useMutation({
    mutationFn: () => createSavedPatient({ data: form as any }),
    onSuccess: () => { toast.success("Saved"); setAdding(false); setForm({ ...EMPTY }); invalidate(); },
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
      kind: (((p as any).kind as Kind) ?? "patient"),
      first_name: p.first_name ?? "", last_name: p.last_name ?? "",
      dob: p.dob ?? "", phone: p.phone ?? "", email: p.email ?? "",
      medicaid_id: p.medicaid_id ?? "", mobility: p.mobility ?? "",
      notes: p.notes ?? "",
      default_pickup_address: p.default_pickup_address ?? "",
      default_pickup_city: p.default_pickup_city ?? "",
      default_dropoff_address: p.default_dropoff_address ?? "",
      default_dropoff_city: p.default_dropoff_city ?? "",
      payer: (p as any).payer ?? "",
      medicaid_number: (p as any).medicaid_number ?? "",
      medicaid_plan: (p as any).medicaid_plan ?? "",
      diagnosis_code: (p as any).diagnosis_code ?? "",
      authorization_number: (p as any).authorization_number ?? "",
      gender: (p as any).gender ?? "",
      address_line1: (p as any).address_line1 ?? "",
      address_line2: (p as any).address_line2 ?? "",
      city: (p as any).city ?? "",
      state: (p as any).state ?? "",
      zip: (p as any).zip ?? "",
    });
  }

  const isEditing = editingId !== null || adding;
  const rows = (q.data ?? []).filter((p: any) => filter === "all" || (p.kind ?? "patient") === filter);
  const isContactForm = form.kind === "contact";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Saved People</h2>
          <p className="text-sm text-muted-foreground">One place for saved patients and contacts — reuse when booking.</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => { setAdding(true); setEditingId(null); setForm({ ...EMPTY }); }}
            className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90"
          >
            Add
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["all", "patient", "contact"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
              filter === k ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {k === "all" ? "All" : k === "patient" ? "Patients" : "Contacts"}
          </button>
        ))}
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {isEditing && (
        <form
          onSubmit={(e) => { e.preventDefault(); (editingId ? updateM : createM).mutate(); }}
          className="bg-card border border-border rounded-sm p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold">{editingId ? "Edit" : "New entry"}</h3>
            <div className="flex gap-1 text-xs font-bold uppercase tracking-wide">
              {(["patient", "contact"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`px-3 py-1 rounded-sm border ${
                    form.kind === k ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground"
                  }`}
                >{k}</button>
              ))}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <Field label="First name *"><input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Last name *"><input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className={inputCls} /></Field>
            {!isContactForm && <Field label="Date of birth"><input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} className={inputCls} /></Field>}
            <Field label="Phone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} /></Field>
            <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
            {!isContactForm && <Field label="Medicaid ID"><input value={form.medicaid_id} onChange={(e) => setForm({ ...form, medicaid_id: e.target.value })} className={inputCls} /></Field>}
            {!isContactForm && <Field label="Mobility (ambulatory, wheelchair, stretcher…)"><input value={form.mobility} onChange={(e) => setForm({ ...form, mobility: e.target.value })} className={inputCls} /></Field>}
            {!isContactForm && <Field label="Default pickup address"><input value={form.default_pickup_address} onChange={(e) => setForm({ ...form, default_pickup_address: e.target.value })} className={inputCls} /></Field>}
            {!isContactForm && <Field label="Default pickup city"><input value={form.default_pickup_city} onChange={(e) => setForm({ ...form, default_pickup_city: e.target.value })} className={inputCls} /></Field>}
            {!isContactForm && <Field label="Default drop-off address"><input value={form.default_dropoff_address} onChange={(e) => setForm({ ...form, default_dropoff_address: e.target.value })} className={inputCls} /></Field>}
            {!isContactForm && <Field label="Default drop-off city"><input value={form.default_dropoff_city} onChange={(e) => setForm({ ...form, default_dropoff_city: e.target.value })} className={inputCls} /></Field>}
          </div>

          {!isContactForm && (
            <>
              <div className="pt-2 mt-2 border-t border-border">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-muted-foreground mb-2">Demographics (for CMS forms)</h4>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <Field label="Gender">
                    <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputCls}>
                      <option value="">Select…</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                      <option value="U">Unknown / Other</option>
                    </select>
                  </Field>
                  <Field label="Home address line 1"><input value={form.address_line1} onChange={(e) => setForm({ ...form, address_line1: e.target.value })} className={inputCls} /></Field>
                  <Field label="Address line 2"><input value={form.address_line2} onChange={(e) => setForm({ ...form, address_line2: e.target.value })} className={inputCls} /></Field>
                  <Field label="City"><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className={inputCls} /></Field>
                  <Field label="State (2-letter)"><input maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} className={inputCls} /></Field>
                  <Field label="ZIP"><input maxLength={10} value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} className={inputCls} /></Field>
                </div>
              </div>

              <div className="pt-2 mt-2 border-t border-border">
                <h4 className="font-extrabold text-sm uppercase tracking-wide text-muted-foreground mb-2">Payer & Medicaid billing</h4>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  <Field label="Payer (Medicaid MCO, insurance, private-pay…)"><input value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })} className={inputCls} /></Field>
                  <Field label="Medicaid plan"><input value={form.medicaid_plan} onChange={(e) => setForm({ ...form, medicaid_plan: e.target.value })} className={inputCls} /></Field>
                  <Field label="Medicaid number"><input value={form.medicaid_number} onChange={(e) => setForm({ ...form, medicaid_number: e.target.value })} className={inputCls} /></Field>
                  <Field label="Authorization number"><input value={form.authorization_number} onChange={(e) => setForm({ ...form, authorization_number: e.target.value })} className={inputCls} /></Field>
                  <Field label="Diagnosis code (ICD-10)"><input value={form.diagnosis_code} onChange={(e) => setForm({ ...form, diagnosis_code: e.target.value.toUpperCase() })} className={inputCls} /></Field>
                </div>
              </div>
            </>
          )}

          <Field label="Notes"><textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} /></Field>
          <div className="flex gap-2">
            <button type="submit" disabled={createM.isPending || updateM.isPending} className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
              {editingId ? (updateM.isPending ? "Saving…" : "Save changes") : (createM.isPending ? "Saving…" : "Save")}
            </button>
            <button type="button" onClick={() => { setAdding(false); setEditingId(null); setForm({ ...EMPTY }); }} className="text-sm font-bold text-muted-foreground hover:underline">Cancel</button>
          </div>
        </form>
      )}

      <ul className="space-y-2">
        {rows.map((p: any) => {
          const kind: Kind = (p.kind ?? "patient") as Kind;
          return (
            <li key={p.id} className="flex items-center justify-between border border-border rounded-sm p-3 bg-card">
              <div className="text-sm min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold truncate">{p.first_name} {p.last_name}</span>
                  <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm ${
                    kind === "contact" ? "bg-secondary text-secondary-foreground" : "bg-accent/15 text-accent"
                  }`}>{kind}</span>
                </div>
                <div className="text-muted-foreground text-xs truncate">
                  {[p.phone, p.email, kind === "patient" && p.medicaid_id ? `Medicaid ${p.medicaid_id}` : null, kind === "patient" ? p.mobility : null].filter(Boolean).join(" • ") || "No contact info"}
                </div>
              </div>
              <div className="flex gap-3 text-sm font-bold shrink-0 ml-3">
                <button onClick={() => startEdit(p)} className="text-primary hover:underline">Edit</button>
                <button onClick={() => { if (confirm(`Remove ${p.first_name} ${p.last_name}?`)) delM.mutate(p.id); }} className="text-destructive hover:underline">Remove</button>
              </div>
            </li>
          );
        })}
        {!q.isLoading && rows.length === 0 && !isEditing && (
          <li className="text-sm text-muted-foreground">Nothing saved yet.</li>
        )}
      </ul>
    </div>
  );
}

const inputCls = "w-full border border-border rounded-sm px-3 py-2 bg-background";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="font-bold text-xs uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

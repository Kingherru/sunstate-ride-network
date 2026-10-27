import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";
import { listMyPayers, createPayer, updatePayer, deletePayer } from "@/lib/payers.functions";
import type { ContactOption } from "@/components/dashboard/ContactsPayersPanel";

type Payer = Awaited<ReturnType<typeof listMyPayers>>[number];

const PAYER_TYPE_LABELS: Record<string, string> = { broker: "Broker", private_patient: "Private Patient", insurance: "Insurance" };
const VEHICLE_LABELS: Record<string, string> = {
  car: "Car", suv: "SUV", van: "Van", wheelchair_van: "Wheelchair Van", stretcher_van: "Stretcher Van", provider_choice: "Leave Up to Provider",
};

/** Show only the last four characters of a tax identifier. */
const maskEin = (ein: string | null) => (ein ? `•••••${ein.replace(/\D/g, "").slice(-4) || ein.slice(-4)}` : null);

export function PayersPanel({ contacts = [] }: { contacts?: ContactOption[] }) {
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["my-payers"], queryFn: () => listMyPayers() });
  const [editing, setEditing] = useState<Partial<Payer> | null>(null);

  const del = usePortalMutation({
    mutationFn: (id: string) => deletePayer({ data: { id } }),
    onSuccess: () => { toast.success("Payer removed"); qc.invalidateQueries({ queryKey: ["my-payers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Payers are billing parties only. They get no access to your account unless you invite them separately. Saved billing methods are managed in a later update.
        </p>
        <button onClick={() => setEditing({ active: true, multi_load_ok: false })}
          className="shrink-0 whitespace-nowrap rounded-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          Add payer
        </button>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <ul className="space-y-2">
        {(q.data ?? []).map((p) => (
          <li key={p.id} className="rounded-sm border border-border bg-card p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{p.name}</span>
                  {p.payer_type && <span className="rounded-sm bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">{PAYER_TYPE_LABELS[p.payer_type] ?? p.payer_type}</span>}
                  <span className={`rounded-sm px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${p.active ? "bg-muted" : "bg-muted text-muted-foreground"}`}>
                    {p.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {[p.email, p.phone, maskEin(p.ein) && `EIN ${maskEin(p.ein)}`].filter(Boolean).join(" • ") || "No contact info"}
                </div>
                {p.linked_contact_id && (
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Linked contact: {contacts.find((c) => c.id === p.linked_contact_id)?.name ?? "Linked contact"}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 gap-3 text-sm font-bold">
                <button onClick={() => setEditing(p)} className="text-primary hover:underline">Edit</button>
                <button
                  onClick={() => { if (confirm(`Remove payer "${p.name}"?`)) del.mutate(p.id); }}
                  className="text-destructive hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
        {!q.isLoading && (q.data ?? []).length === 0 && (
          <li className="text-sm text-muted-foreground">No payers yet.</li>
        )}
      </ul>

      {editing && (
        <PayerDialog
          payer={editing}
          contacts={contacts}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["my-payers"] }); }}
        />
      )}
    </div>
  );
}

function PayerDialog({ payer, contacts, onClose, onSaved }: { payer: Partial<Payer>; contacts: ContactOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    name: payer.name ?? "",
    email: payer.email ?? "",
    phone: payer.phone ?? "",
    billing_address: payer.billing_address ?? "",
    ein: payer.ein ?? "",
    payer_type: payer.payer_type ?? "",
    active: payer.active ?? true,
    linked_contact_id: payer.linked_contact_id ?? "",
    multi_load_ok: payer.multi_load_ok ?? false,
    preferred_driver: payer.preferred_driver ?? "",
    vehicle_preference: payer.vehicle_preference ?? "",
    pickup_signature_required: payer.pickup_signature_required ?? false,
    dropoff_signature_required: payer.dropoff_signature_required ?? false,
    early_late_preference: payer.early_late_preference ?? "",
    early_late_minutes: payer.early_late_minutes ?? "",
    notes: payer.notes ?? "",
  });

  const save = usePortalMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        payer_type: form.payer_type || null,
        vehicle_preference: form.vehicle_preference || null,
        early_late_preference: form.early_late_preference || null,
        early_late_minutes: form.early_late_minutes === "" ? null : Number(form.early_late_minutes),
        linked_contact_id: form.linked_contact_id || null,
      };
      const r = payer.id
        ? await updatePayer({ data: { ...payload, id: payer.id } })
        : await createPayer({ data: payload });
      if ("error" in r) throw new Error(r.error);
    },
    onSuccess: () => { toast.success("Payer saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const set = (k: string, v: unknown) => setForm((f: any) => ({ ...f, [k]: v }));
  const inp = "rounded-sm border border-border bg-background px-3 py-2";
  const lbl = "flex flex-col gap-1 text-sm";
  const cap = "text-xs font-bold uppercase tracking-wide text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid max-h-[90vh] w-full max-w-2xl gap-3 overflow-auto rounded-sm bg-card p-6 sm:grid-cols-2">
        <h3 className="text-xl font-extrabold sm:col-span-2">{payer.id ? "Edit payer" : "New payer"}</h3>

        <label className={lbl}><span className={cap}>Billing name *</span>
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inp} /></label>
        <label className={lbl}><span className={cap}>Billing email</span>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} className={inp} /></label>
        <label className={lbl}><span className={cap}>Phone</span>
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} className={inp} /></label>
        <label className={lbl}><span className={cap}>Payer type</span>
          <select value={form.payer_type} onChange={(e) => set("payer_type", e.target.value)} className={inp}>
            <option value="">Not specified</option>
            {Object.entries(PAYER_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className={`${lbl} sm:col-span-2`}><span className={cap}>Billing address</span>
          <input value={form.billing_address} onChange={(e) => set("billing_address", e.target.value)} className={inp} /></label>
        <label className={lbl}><span className={cap}>EIN (where applicable)</span>
          <input value={form.ein} onChange={(e) => set("ein", e.target.value)} className={inp} placeholder="Only last 4 digits are shown later" /></label>
        <label className={lbl}><span className={cap}>Linked contact</span>
          <select value={form.linked_contact_id} onChange={(e) => set("linked_contact_id", e.target.value)} className={inp}>
            <option value="">None</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>

        <label className={lbl}><span className={cap}>Vehicle preference</span>
          <select value={form.vehicle_preference} onChange={(e) => set("vehicle_preference", e.target.value)} className={inp}>
            <option value="">Not specified</option>
            {Object.entries(VEHICLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></label>
        <label className={lbl}><span className={cap}>Preferred driver</span>
          <input value={form.preferred_driver} onChange={(e) => set("preferred_driver", e.target.value)} className={inp} placeholder="Name, or leave blank" />
          <span className="text-xs text-muted-foreground">Leave blank to leave driver choice up to the provider. A preference never assigns a driver.</span></label>

        <div className={lbl}><span className={cap}>Pickup timing preference</span>
          <div className="flex items-center gap-2">
            <select value={form.early_late_preference} onChange={(e) => set("early_late_preference", e.target.value)} className={inp}>
              <option value="">No preference</option>
              <option value="early">Early pickup</option>
              <option value="late">Late pickup</option>
            </select>
            {form.early_late_preference && (
              <input type="number" min={0} max={240} value={form.early_late_minutes} onChange={(e) => set("early_late_minutes", e.target.value)}
                className={`${inp} w-24`} aria-label="Minutes" placeholder="Min" />
            )}
          </div></div>
        <div className="flex flex-col gap-2 text-sm">
          <span className={cap}>Requirements</span>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.pickup_signature_required} onChange={(e) => set("pickup_signature_required", e.target.checked)} /> Pickup signature required</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.dropoff_signature_required} onChange={(e) => set("dropoff_signature_required", e.target.checked)} /> Drop-off signature required</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.multi_load_ok} onChange={(e) => set("multi_load_ok", e.target.checked)} /> Multi-load permitted</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Active</label>
        </div>

        <label className={`${lbl} sm:col-span-2`}><span className={cap}>Additional notes</span>
          <textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inp} /></label>

        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button disabled={save.isPending}
            className="rounded-sm bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {save.isPending ? "Saving…" : "Save payer"}
          </button>
        </div>
      </form>
    </div>
  );
}

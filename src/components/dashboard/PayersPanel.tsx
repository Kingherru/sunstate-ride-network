import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePortalMutation, usePortalQuery,usePortalPreview } from "@/components/portal/preview-data";
import { listMyPayers, createPayer, updatePayer, deletePayer } from "@/lib/payers.functions";
import type { ContactOption } from "@/components/dashboard/ContactsPayersPanel";
import {DsButton} from '@/components/ds/controls';
import {RegionalAddressFields} from '@/components/forms/RegionalAddressFields';
import {PayerAgreement} from '@/components/portal/PayerAgreement';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

type Payer = Awaited<ReturnType<typeof listMyPayers>>[number];

const PAYER_TYPE_LABELS: Record<string, string> = { broker: "Broker", private_patient: "Private Patient", insurance: "Insurance" };
const VEHICLE_LABELS: Record<string, string> = {
  car: "Car", suv: "SUV", van: "Van", wheelchair_van: "Wheelchair Van", stretcher_van: "Stretcher Van", provider_choice: "Leave Up to Provider",
};

/** Show only the last four characters of a tax identifier. */
const maskEin = (ein: string | null) => (ein ? `•••••${ein.replace(/\D/g, "").slice(-4) || ein.slice(-4)}` : null);

export function PayersPanel({ contacts = [] }: { contacts?: ContactOption[] }) {
  const preview=usePortalPreview();const [sample,setSample]=useState(false);
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["my-payers"], queryFn: () => listMyPayers(),staleTime:0,gcTime:0 });
  const [editing, setEditing] = useState<Partial<Payer> | null>(null);
  const [agreement,setAgreement]=useState<Payer|null>(null);

  const del = usePortalMutation({
    mutationFn: (id: string) => deletePayer({ data: { id } }),
    onSuccess: () => { toast.success("Payer removed"); qc.invalidateQueries({ queryKey: ["my-payers"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {preview.active&&<DsButton size="sm" variant="ghost" onClick={()=>setSample(true)}>Preview payer agreement</DsButton>}
      {sample&&<PayerAgreement workspaceId="00000000-0000-4000-8000-000000000001" payerId="00000000-0000-4000-8000-000000000002" onClose={()=>setSample(false)}/>}
      {agreement?.workspace_id&&<PayerAgreement workspaceId={agreement.workspace_id} payerId={agreement.id} onClose={()=>setAgreement(null)}/>}
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] border-b border-ds-border pb-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Payers are billing contacts, not account members. Payment-method collection is unavailable until secure tokenized setup is activated.
        </p>
        <DsButton onClick={() => setEditing({ active: true, multi_load_ok: false })}>
          Add payer
        </DsButton>
      </div>

      {q.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

      <ul className="divide-y divide-ds-border">
        {(q.data ?? []).map((p) => (
          <li key={p.id} className="min-w-0 py-4">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
              <div className="portal-toolbar text-sm font-bold">
                {p.workspace_id&&<DsButton variant="ghost" size="sm" onClick={()=>setAgreement(p)}>Rate agreement</DsButton>}
                <DsButton variant="ghost" size="sm" onClick={() => setEditing(p)}>Edit</DsButton>
                <DsButton variant="ghost" size="sm"
                  onClick={() => { if (confirm(`Remove payer "${p.name}"?`)) del.mutate(p.id); }}
                  className="text-ds-error"
                >
                  Remove
                </DsButton>
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

export function PayerDialog({ payer, contacts, onClose, onSaved }: { payer: Partial<Payer>; contacts: ContactOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    name: payer.name ?? "",
    email: payer.email ?? "",
    phone: payer.phone ?? "",
    billing_state:payer.billing_state??'',billing_zip:payer.billing_zip??'',billing_county:payer.billing_county??'',billing_timezone:payer.billing_timezone??'',
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
  const inp = "portal-input min-w-0 w-full";
  const lbl = "flex min-w-0 flex-col gap-1 text-sm";
  const cap = "ds-label text-ds-primary";

  return (
    <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}><DialogContent className="theme-portal !max-w-2xl"><DialogTitle className="uppercase text-ds-primary">{payer.id ? "Edit payer" : "New payer"}</DialogTitle>
      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="grid min-w-0 w-full gap-4 sm:grid-cols-2">

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
        <div className="sm:col-span-2"><RegionalAddressFields value={{pickupState:form.billing_state,pickupZip:form.billing_zip,pickupCounty:form.billing_county,pickupTimezone:form.billing_timezone}} side="pickup" onChange={v=>setForm({...form,billing_state:v.pickupState??form.billing_state,billing_zip:v.pickupZip??form.billing_zip,billing_county:v.pickupCounty??form.billing_county,billing_timezone:v.pickupTimezone??form.billing_timezone})}/></div>
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
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
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
          <DsButton type="button" variant="ghost" onClick={onClose}>Cancel</DsButton>
          <DsButton disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save payer"}
          </DsButton>
        </div>
      </form>
    </DialogContent></Dialog>
  );
}

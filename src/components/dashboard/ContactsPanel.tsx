import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { listContacts, upsertContact, deleteContact } from "@/lib/crm.functions";
import { CONTACT_TYPES } from '@/lib/contact-rules';
import {DsButton} from '@/components/ds/controls';
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";

type Contact = Awaited<ReturnType<typeof listContacts>>[number];
export type PayerOption = { id: string; name: string };

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  personal: "Authorized Contact",
  patient: "Patient",
  caregiver: "Caregiver / Authorized Contact",
  broker: "Broker",
  organization: "Organization",
  facility: "Facility Contact",
  business: "Business Contact",
  payer: "Payer Contact",
};
const contactTypeLabel = (t: string | null) =>
  CONTACT_TYPE_LABELS[t ?? ""] ?? (t ? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");

export function ContactsPanel({ payers = [] }: { payers?: PayerOption[] }) {
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["contacts"], queryFn: () => listContacts(),staleTime:0,gcTime:0 });
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [filter, setFilter] = useState("");

  const del = usePortalMutation({
    mutationFn: (id: string) => deleteContact({ data: { id } }),
    onSuccess: () => { toast.success("Contact disabled; history retained"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
    onError: () => toast.error('Contact not available'),
  });

  const contacts = (q.data ?? []).filter((c: Contact) => {
    const s = `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.company_name ?? ""} ${c.email ?? ""} ${c.phone ?? ""}`.toLowerCase();
    return s.includes(filter.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="portal-search min-w-0 flex-1">
          <Search className="size-4" aria-hidden />
          <input
            placeholder="Search contacts…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search contacts"
            className="w-full rounded-sm border border-border py-2 pr-3 text-sm"
          />
        </div>
        <DsButton onClick={() => setEditing({ contact_type: "personal" })} className="shrink-0 whitespace-nowrap">
          + New contact
        </DsButton>
      </div>

      {q.isError ? <p role="alert" className="text-destructive">Contacts not available. Try again.</p> : q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center text-muted-foreground">
          No contacts yet. Add personal, facility, business, or payer contacts to speed up future bookings.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-sm border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Contact</th>
                <th className="px-3 py-2 text-left">Payer</th>
                <th className="px-3 py-2 text-left">Relationship / use</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: Contact) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2">{contactTypeLabel(c.contact_type)}</td>
                  <td className="px-3 py-2 font-bold">
                    {c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {(c as any).payer_id ? payers.find((p) => p.id === (c as any).payer_id)?.name ?? "Linked payer" : c.payer ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs"><div>{c.relationship||'Not provided'}</div><div className={c.active?'text-ds-success':'text-ds-error'}>{c.active?'Active':'Disabled'}</div><div>{c.billing_allowed?'Billing coordination':'No billing authorization'} · {c.coordination_allowed?'Trip coordination':'No trip coordination'}</div></td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <DsButton variant="ghost" size="sm" onClick={() => setEditing(c)}>Edit</DsButton>
                    <DsButton variant="ghost" size="sm" disabled={!c.active} onClick={() => { if (confirm("Disable this contact? Historical references remain.")) del.mutate(c.id); }}>Disable</DsButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ContactDialog contact={editing} payers={payers} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["contacts"] }); }} />
      )}
    </div>
  );
}

export function ContactDialog({ contact, payers, onClose, onSaved }: { contact: Partial<Contact>; payers: PayerOption[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    contact_type: contact.contact_type ?? "personal",
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    company_name: contact.company_name ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    payer: contact.payer ?? "",
    payer_id: (contact as any).payer_id ?? "",
    mobility_notes: contact.mobility_notes ?? "",
    notes: contact.notes ?? "",
    relationship:contact.relationship??'',active:contact.active??true,billing_allowed:contact.billing_allowed??false,coordination_allowed:contact.coordination_allowed??false,
  });
  const m = usePortalMutation({
    mutationFn: () => upsertContact({ data: { ...form, payer_id: form.payer_id || null, id: contact.id } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div role="dialog" aria-modal="true" aria-label={contact.id?'Edit contact':'New contact'} className="fixed inset-0 z-50 flex items-center justify-center bg-ds-primary/40 p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="grid max-h-[90vh] w-full max-w-2xl gap-3 overflow-auto rounded-sm bg-card p-6 sm:grid-cols-2">
        <h3 className="text-xl font-extrabold sm:col-span-2">{contact.id ? "Edit contact" : "New contact"}</h3>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold">Type *</span>
          <select required value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
                  className="rounded-sm border border-border bg-background px-3 py-2">
            {CONTACT_TYPES.map((t) => <option key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</option>)}
          </select>
        </label>
        <Inp l="First name" v={form.first_name} on={(v) => setForm({ ...form, first_name: v })} />
        <Inp l="Last name" v={form.last_name} on={(v) => setForm({ ...form, last_name: v })} />
        <Inp l="Company / organization" v={form.company_name} on={(v) => setForm({ ...form, company_name: v })} cs={2} />
        <Inp l="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
        <Inp l="Email" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
        <Inp l="Relationship" v={form.relationship} on={v=>setForm({...form,relationship:v})} cs={2}/>
        <div className="grid gap-2 text-sm sm:col-span-2"><label><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/> Active</label><label><input type="checkbox" checked={form.billing_allowed} onChange={e=>setForm({...form,billing_allowed:e.target.checked})}/> Authorized for billing coordination</label><label><input type="checkbox" checked={form.coordination_allowed} onChange={e=>setForm({...form,coordination_allowed:e.target.checked})}/> Authorized for trip coordination</label></div>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-bold">Linked payer</span>
          <select value={form.payer_id} onChange={(e) => setForm({ ...form, payer_id: e.target.value })}
                  className="rounded-sm border border-border bg-background px-3 py-2">
            <option value="">None</option>
            {payers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">A linked contact also appears on the Payers tab without duplicating the record.</span>
        </label>
        <Area l="Mobility notes" v={form.mobility_notes} on={(v) => setForm({ ...form, mobility_notes: v })} />
        <Area l="Notes" v={form.notes} on={(v) => setForm({ ...form, notes: v })} />
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <DsButton type="button" variant="ghost" onClick={onClose}>Cancel</DsButton>
          <DsButton disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save"}
          </DsButton>
        </div>
      </form>
    </div>
  );
}

function Inp({ l, v, on, type = "text", cs, placeholder }: { l: string; v: string; on: (v: string) => void; type?: string; cs?: number; placeholder?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${cs === 2 ? "sm:col-span-2" : ""}`}>
      <span className="font-bold">{l}</span>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder}
             className="rounded-sm border border-border bg-background px-3 py-2" />
    </label>
  );
}
function Area({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span className="font-bold">{l}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={2}
                className="rounded-sm border border-border bg-background px-3 py-2" />
    </label>
  );
}

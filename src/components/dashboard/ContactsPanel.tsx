import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { listContacts, upsertContact, deleteContact, CONTACT_TYPES } from "@/lib/crm.functions";
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";

type Contact = Awaited<ReturnType<typeof listContacts>>[number];
export type PayerOption = { id: string; name: string };

export const CONTACT_TYPE_LABELS: Record<string, string> = {
  personal: "Personal Contact",
  facility: "Facility Contact",
  business: "Business Contact",
  payer: "Payer Contact",
};
const contactTypeLabel = (t: string | null) =>
  CONTACT_TYPE_LABELS[t ?? ""] ?? (t ? t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");

export function ContactsPanel({ payers = [] }: { payers?: PayerOption[] }) {
  const qc = useQueryClient();
  const q = usePortalQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [filter, setFilter] = useState("");

  const del = usePortalMutation({
    mutationFn: (id: string) => deleteContact({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["contacts"] }); },
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
        <button onClick={() => setEditing({ contact_type: "personal" })}
                className="shrink-0 whitespace-nowrap rounded-sm bg-primary px-4 py-2 text-sm font-bold text-primary-foreground hover:bg-primary/90">
          + New contact
        </button>
      </div>

      {q.isLoading ? (
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
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <button onClick={() => setEditing(c)} className="mr-3 text-xs font-bold text-primary hover:underline">Edit</button>
                    <button onClick={() => { if (confirm("Delete this contact?")) del.mutate(c.id); }}
                            className="text-xs font-bold text-red-600 hover:underline">Delete</button>
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

function ContactDialog({ contact, payers, onClose, onSaved }: { contact: Partial<Contact>; payers: PayerOption[]; onClose: () => void; onSaved: () => void }) {
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
  });
  const m = usePortalMutation({
    mutationFn: () => upsertContact({ data: { ...form, payer_id: form.payer_id || null, id: contact.id } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
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
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button disabled={m.isPending}
                  className="rounded-sm bg-primary px-5 py-2 font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save"}
          </button>
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

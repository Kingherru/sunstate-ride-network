import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listContacts, upsertContact, deleteContact } from "@/lib/crm.functions";

type Contact = Awaited<ReturnType<typeof listContacts>>[number];

const TYPES = ["patient", "caregiver", "facility", "broker", "organization"] as const;

export function ContactsPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["contacts"], queryFn: () => listContacts() });
  const [editing, setEditing] = useState<Partial<Contact> | null>(null);
  const [filter, setFilter] = useState("");

  const del = useMutation({
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
        <input
          placeholder="Search contacts…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-border rounded-sm px-3 py-2 text-sm flex-1 min-w-[200px] bg-background"
        />
        <button onClick={() => setEditing({ contact_type: "patient" })}
                className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 text-sm">
          + New contact
        </button>
      </div>

      {q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="bg-card border border-border rounded-sm p-8 text-center text-muted-foreground">
          No contacts yet. Add patients, caregivers, facilities, brokers, or organizations to speed up future bookings.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
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
                  <td className="px-3 py-2 capitalize">{c.contact_type}</td>
                  <td className="px-3 py-2 font-bold">
                    {c.company_name || `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {c.email && <div>{c.email}</div>}
                    {c.phone && <div className="text-muted-foreground">{c.phone}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{c.payer ?? "—"}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(c)} className="text-xs font-bold text-primary hover:underline mr-3">Edit</button>
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
        <ContactDialog contact={editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["contacts"] }); }} />
      )}
    </div>
  );
}

function ContactDialog({ contact, onClose, onSaved }: { contact: Partial<Contact>; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<any>({
    contact_type: contact.contact_type ?? "patient",
    first_name: contact.first_name ?? "",
    last_name: contact.last_name ?? "",
    company_name: contact.company_name ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    payer: contact.payer ?? "",
    mobility_notes: contact.mobility_notes ?? "",
    notes: contact.notes ?? "",
  });
  const m = useMutation({
    mutationFn: () => upsertContact({ data: { ...form, id: contact.id } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="bg-card rounded-sm max-w-2xl w-full p-6 grid grid-cols-2 gap-3 max-h-[90vh] overflow-auto">
        <h3 className="col-span-2 text-xl font-extrabold">{contact.id ? "Edit contact" : "New contact"}</h3>
        <label className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-bold">Type *</span>
          <select required value={form.contact_type} onChange={(e) => setForm({ ...form, contact_type: e.target.value })}
                  className="border border-border rounded-sm px-3 py-2 bg-background capitalize">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <Inp l="First name" v={form.first_name} on={(v) => setForm({ ...form, first_name: v })} />
        <Inp l="Last name" v={form.last_name} on={(v) => setForm({ ...form, last_name: v })} />
        <Inp l="Company / organization" v={form.company_name} on={(v) => setForm({ ...form, company_name: v })} cs={2} />
        <Inp l="Phone" v={form.phone} on={(v) => setForm({ ...form, phone: v })} />
        <Inp l="Email" v={form.email} on={(v) => setForm({ ...form, email: v })} type="email" />
        <Inp l="Payer" v={form.payer} on={(v) => setForm({ ...form, payer: v })} cs={2} placeholder="Medicaid, private, broker name…" />
        <Area l="Mobility notes" v={form.mobility_notes} on={(v) => setForm({ ...form, mobility_notes: v })} />
        <Area l="Notes" v={form.notes} on={(v) => setForm({ ...form, notes: v })} />
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
          <button disabled={m.isPending}
                  className="bg-primary text-primary-foreground font-bold px-5 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50">
            {m.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Inp({ l, v, on, type = "text", cs, placeholder }: { l: string; v: string; on: (v: string) => void; type?: string; cs?: number; placeholder?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${cs === 2 ? "col-span-2" : ""}`}>
      <span className="font-bold">{l}</span>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder}
             className="border border-border rounded-sm px-3 py-2 bg-background" />
    </label>
  );
}
function Area({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <label className="col-span-2 flex flex-col gap-1 text-sm">
      <span className="font-bold">{l}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={2}
                className="border border-border rounded-sm px-3 py-2 bg-background" />
    </label>
  );
}

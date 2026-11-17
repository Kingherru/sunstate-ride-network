import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { listContacts, upsertContact, deleteContact } from "@/lib/crm.functions";
import { CONTACT_TYPES } from '@/lib/contact-rules';
import {DsButton} from '@/components/ds/controls';
import {Dialog,DialogContent,DialogTitle} from '@/components/ui/dialog';
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";
import {RegionalAddressFields} from '@/components/forms/RegionalAddressFields';
import {ContactImportExport} from '@/components/portal/ContactImportExport';
import {RecordTable} from '@/components/portal/RecordTable';

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
      <div className="portal-toolbar border-b border-ds-border pb-3">
        <ContactImportExport contacts={q.data??[]}/>
        <DsButton onClick={() => setEditing({ contact_type: "personal" })}>+ New contact</DsButton>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="portal-search min-w-0">
          <Search className="size-4" aria-hidden />
          <input
            placeholder="Search contacts…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Search contacts"
            className="portal-input w-full"
          />
        </div>
      </div>

      {q.isError ? <p role="alert" className="text-destructive">Contacts not available. Try again.</p> : q.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <div className="rounded-sm border border-border bg-card p-8 text-center text-muted-foreground">
          No contacts yet. Add personal, facility, business, or payer contacts to speed up future bookings.
        </div>
      ) : (
        <RecordTable<Contact> tableId="people-contacts" rows={contacts} rowKey={c=>c.id} columns={[
          {id:'type',label:'Type',width:190,render:c=>contactTypeLabel(c.contact_type)},
          {id:'name',label:'Name',width:220,render:c=>c.company_name || `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim() || '—'},
          {id:'contact',label:'Contact',width:230,wrap:true,render:c=><>{c.email&&<div>{c.email}</div>}{c.phone&&<div className="text-ds-text-2">{c.phone}</div>}</>},
          {id:'payer',label:'Payer',width:190,render:c=>(c as any).payer_id ? payers.find(p=>p.id===(c as any).payer_id)?.name ?? 'Linked payer' : c.payer ?? '—'},
          {id:'relationship',label:'Relationship / use',width:250,wrap:true,render:c=><><div>{c.relationship||'Not provided'}</div><div className={c.active?'text-ds-success':'text-ds-error'}>{c.active?'Active':'Disabled'}</div><div>{c.billing_allowed?'Billing coordination':'No billing authorization'} · {c.coordination_allowed?'Trip coordination':'No trip coordination'}</div></>},
          {id:'actions',label:'Actions',minWidth:170,width:190,wrap:true,render:c=><div className="portal-record-actions"><DsButton variant="ghost" size="sm" onClick={()=>setEditing(c)}>Edit</DsButton><DsButton variant="ghost" size="sm" disabled={!c.active} onClick={()=>{if(confirm('Disable this contact? Historical references remain.'))del.mutate(c.id);}}>Disable</DsButton></div>},
        ]}/>
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
    address:contact.address??'',city:contact.city??'',state:contact.state??'',zip:contact.zip??'',county_equivalent:contact.county_equivalent??'',timezone:contact.timezone??'',
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
    contact_roles:contact.contact_roles??[],
  });
  const m = usePortalMutation({
    mutationFn: () => upsertContact({ data: { ...form, payer_id: form.payer_id || null, id: contact.id } }),
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <Dialog open onOpenChange={open=>{if(!open&&!m.isPending)onClose();}}><DialogContent className="theme-portal max-h-[90dvh] overflow-y-auto !max-w-2xl"><DialogTitle>{contact.id?'Edit contact':'New contact'}</DialogTitle>
      <form
            onSubmit={(e) => { e.preventDefault(); m.mutate(); }}
            className="grid min-w-0 w-full gap-4 sm:grid-cols-2">
        <fieldset className="space-y-2 sm:col-span-2"><legend className="ds-label text-ds-primary">Roles</legend><div className="grid gap-2 sm:grid-cols-2">{(['family','facility','business','payer','emergency','other'] as const).map(role=><label key={role} className="ds-body flex gap-2"><input type="checkbox" checked={form.contact_roles.includes(role)} onChange={e=>setForm({...form,contact_roles:e.target.checked?[...form.contact_roles,role]:form.contact_roles.filter((r:string)=>r!==role)})}/>{({family:'Family',facility:'Facility Contact',business:'Business Contact',payer:'Payer',emergency:'Emergency Contact',other:'Other'})[role]}</label>)}</div></fieldset>
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
        <Inp l="Address" v={form.address} on={v=>setForm({...form,address:v})} cs={2}/><Inp l="City / locality" v={form.city} on={v=>setForm({...form,city:v})}/>
        <div className="sm:col-span-2"><RegionalAddressFields value={{pickupState:form.state,pickupZip:form.zip,pickupCounty:form.county_equivalent,pickupTimezone:form.timezone}} side="pickup" onChange={v=>setForm({...form,state:v.pickupState??form.state,zip:v.pickupZip??form.zip,county_equivalent:v.pickupCounty??form.county_equivalent,timezone:v.pickupTimezone??form.timezone})}/></div>
        <Area l="Mobility notes" v={form.mobility_notes} on={(v) => setForm({ ...form, mobility_notes: v })} />
        <Area l="Notes" v={form.notes} on={(v) => setForm({ ...form, notes: v })} />
        <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
          <DsButton type="button" variant="ghost" onClick={onClose}>Cancel</DsButton>
          <DsButton disabled={m.isPending}>
            {m.isPending ? "Saving…" : "Save"}
          </DsButton>
        </div>
      </form>
    </DialogContent></Dialog>
  );
}

function Inp({ l, v, on, type = "text", cs, placeholder }: { l: string; v: string; on: (v: string) => void; type?: string; cs?: number; placeholder?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${cs === 2 ? "sm:col-span-2" : ""}`}>
      <span className="ds-label text-ds-primary">{l}</span>
      <input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder}
             className="portal-input min-w-0" />
    </label>
  );
}
function Area({ l, v, on }: { l: string; v: string; on: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm sm:col-span-2">
      <span className="ds-label text-ds-primary">{l}</span>
      <textarea value={v} onChange={(e) => on(e.target.value)} rows={2}
                className="rounded-sm border border-border bg-background px-3 py-2" />
    </label>
  );
}

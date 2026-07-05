import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMedicaidContacts, saveMedicaidContact, deleteMedicaidContact,
  listPackets, getPacket, savePacket, deletePacket,
  addPacketItem, removePacketItem, listMyCompletedTrips,
} from "@/lib/medicaid.functions";

export function MedicaidSubmissionCenter({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"packets" | "contacts" | "directory" | "eligibility">("packets");
  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Provider Portal</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Medicaid Submission Center</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Prepare Medicaid packets, upload supporting docs, save billing contacts, and track your submissions.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-border">
        {(["packets", "contacts", "directory", "eligibility"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wide border-b-2 -mb-px ${
              tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t === "packets" ? "Packets" : t === "contacts" ? "My contacts" : t === "directory" ? "State directory" : "Eligibility"}
          </button>
        ))}
      </nav>

      {tab === "packets" && <PacketsTab userId={userId} />}
      {tab === "contacts" && <ContactsTab scope="mine" />}
      {tab === "directory" && <ContactsTab scope="directory" />}
      {tab === "eligibility" && <EligibilityTab />}
    </div>
  );
}

// ─────────────────────── Contacts ───────────────────────

function ContactsTab({ scope }: { scope: "mine" | "directory" }) {
  const qc = useQueryClient();
  const list = useServerFn(listMedicaidContacts);
  const save = useServerFn(saveMedicaidContact);
  const del = useServerFn(deleteMedicaidContact);

  const q = useQuery({ queryKey: ["medicaid-contacts", scope], queryFn: () => list({ data: { scope } }) });
  const [editing, setEditing] = useState<any | null>(null);
  const canEdit = scope === "mine";

  const saveMut = useMutation({
    mutationFn: (p: any) => save({ data: p }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["medicaid-contacts"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicaid-contacts"] }),
  });

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">
            {scope === "mine" ? "My Medicaid contacts" : "Statewide Medicaid directory"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {scope === "mine"
              ? "Save billing contacts you work with. Toggle 'Share with statewide directory' to help other providers."
              : "Contacts other Florida NEMT providers have shared. Read-only."}
          </p>
        </div>
        {canEdit && (
          <button className="portal-btn-primary px-3 py-2 text-sm"
            onClick={() => setEditing({ contact_name: "", is_public: false })}>+ Add contact</button>
        )}
      </div>

      {editing && canEdit && (
        <div className="border border-border rounded-sm p-4 grid grid-cols-2 gap-3 bg-background">
          <Field label="Contact name *" v={editing.contact_name} on={(v) => setEditing({ ...editing, contact_name: v })} />
          <Field label="Organization" v={editing.organization ?? ""} on={(v) => setEditing({ ...editing, organization: v })} />
          <Field label="Email" v={editing.email ?? ""} on={(v) => setEditing({ ...editing, email: v })} type="email" />
          <Field label="Phone" v={editing.phone ?? ""} on={(v) => setEditing({ ...editing, phone: v })} />
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!editing.is_public} onChange={(e) => setEditing({ ...editing, is_public: e.target.checked })} />
            Share with statewide Florida NEMT directory
          </label>
          <label className="block col-span-2">
            <span className="portal-label">Notes</span>
            <textarea className="portal-input" rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </label>
          <div className="col-span-2 flex gap-2">
            <button className="portal-btn-primary px-4 py-2 text-sm" disabled={saveMut.isPending}
              onClick={() => saveMut.mutate(editing)}>{saveMut.isPending ? "Saving…" : "Save"}</button>
            <button className="text-sm font-bold text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-border text-xs uppercase text-muted-foreground">
            <tr><th className="py-2">Name</th><th>Organization</th><th>Email</th><th>Phone</th><th></th></tr>
          </thead>
          <tbody>
            {(q.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No contacts yet.</td></tr>
            )}
            {(q.data ?? []).map((c: any) => (
              <tr key={c.id} className="border-b border-border/50 align-top">
                <td className="py-2">
                  <div className="font-bold">{c.contact_name}</div>
                  {c.notes && <div className="text-xs text-muted-foreground max-w-[220px]">{c.notes}</div>}
                </td>
                <td>{c.organization ?? "—"}</td>
                <td>{c.email ?? "—"}</td>
                <td>{c.phone ?? "—"}</td>
                <td className="text-right whitespace-nowrap">
                  {canEdit && (
                    <>
                      <button className="text-xs font-bold text-accent hover:underline mr-3" onClick={() => setEditing(c)}>Edit</button>
                      <button className="text-xs font-bold text-red-600 hover:underline" onClick={() => confirm("Delete?") && delMut.mutate(c.id)}>Delete</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────── Packets ───────────────────────

function PacketsTab({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const list = useServerFn(listPackets);
  const save = useServerFn(savePacket);
  const del = useServerFn(deletePacket);

  const packetsQ = useQuery({ queryKey: ["medicaid-packets", userId], queryFn: () => list() });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const createMut = useMutation({
    mutationFn: (title: string) => save({ data: { title } }),
    onSuccess: (r: any) => { setCreating(false); setNewTitle(""); setOpenId(r.id); qc.invalidateQueries({ queryKey: ["medicaid-packets"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicaid-packets"] }),
  });

  if (openId) {
    return <PacketDetail id={openId} onBack={() => setOpenId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold tracking-tight">Submission packets</h3>
        <button className="portal-btn-primary px-3 py-2 text-sm" onClick={() => setCreating(true)}>+ New packet</button>
      </div>
      {creating && (
        <div className="bg-card border border-border rounded-sm p-4 flex gap-3 items-end">
          <label className="flex-1 block">
            <span className="portal-label">Packet title</span>
            <input className="portal-input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. Sunshine Health — Week of Nov 3" />
          </label>
          <button className="portal-btn-primary px-4 py-2" disabled={!newTitle.trim() || createMut.isPending}
            onClick={() => createMut.mutate(newTitle.trim())}>
            {createMut.isPending ? "Creating…" : "Create"}
          </button>
          <button className="text-sm font-bold text-muted-foreground" onClick={() => setCreating(false)}>Cancel</button>
        </div>
      )}

      <div className="bg-card border border-border rounded-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-border text-xs uppercase text-muted-foreground">
            <tr><th className="py-2 px-4">Title</th><th>Status</th><th>Contact</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {(packetsQ.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No packets yet. Create one to get started.</td></tr>
            )}
            {(packetsQ.data ?? []).map((p: any) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-3 px-4">
                  <button className="font-bold hover:underline" onClick={() => setOpenId(p.id)}>{p.title}</button>
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-xs">{p.medicaid_contacts?.organization ?? p.medicaid_contacts?.contact_name ?? "—"}</td>
                <td className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="text-right pr-4">
                  <button className="text-xs font-bold text-red-600 hover:underline" onClick={() => confirm("Delete packet?") && delMut.mutate(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    ready: "bg-accent/15 text-accent",
    submitted: "bg-blue-100 text-blue-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-sm ${map[status] ?? map.draft}`}>{status}</span>;
}

function PacketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getPacket);
  const save = useServerFn(savePacket);
  const addItem = useServerFn(addPacketItem);
  const rmItem = useServerFn(removePacketItem);
  const listTrips = useServerFn(listMyCompletedTrips);
  const listContacts = useServerFn(listMedicaidContacts);

  const pktQ = useQuery({ queryKey: ["medicaid-packet", id], queryFn: () => get({ data: { id } }) });
  const contactsQ = useQuery({ queryKey: ["medicaid-contacts", "mine"], queryFn: () => listContacts({ data: { scope: "mine" } }) });
  const tripsQ = useQuery({ queryKey: ["my-completed-trips"], queryFn: () => listTrips() });

  const pkt = pktQ.data;
  const [showAddTrips, setShowAddTrips] = useState(false);
  const [uploading, setUploading] = useState(false);

  const saveMut = useMutation({
    mutationFn: (p: any) => save({ data: { id, ...p } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["medicaid-packet", id] }); qc.invalidateQueries({ queryKey: ["medicaid-packets"] }); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const addMut = useMutation({
    mutationFn: (payload: any) => addItem({ data: { packet_id: id, ...payload } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicaid-packet", id] }),
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const rmMut = useMutation({
    mutationFn: (itemId: string) => rmItem({ data: { id: itemId } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["medicaid-packet", id] }),
  });

  async function uploadAndAttach(file: File, kind: "trip_log" | "document") {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const uid = crypto.randomUUID();
      const path = `packets/${id}/${uid}.${ext}`;
      const { error } = await supabase.storage.from("provider-docs").upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      await addMut.mutateAsync({ kind, doc_path: path, label: file.name, meta: { size: file.size, mime: file.type } });
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  const addedTripIds = useMemo(
    () => new Set((pkt?.items ?? []).filter((i: any) => i.kind === "trip").map((i: any) => i.trip_id)),
    [pkt],
  );

  if (pktQ.isLoading) return <div className="text-sm text-muted-foreground">Loading packet…</div>;
  if (!pkt) return <div className="text-sm">Packet not found. <button onClick={onBack} className="text-accent underline">Back</button></div>;

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-accent hover:underline">← Back to packets</button>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title" v={pkt.title} on={(v) => saveMut.mutate({ title: v, status: pkt.status, medicaid_contact_id: pkt.medicaid_contact_id, submission_reference: pkt.submission_reference, notes: pkt.notes })} />
          <label className="block">
            <span className="portal-label">Status</span>
            <select className="portal-input" value={pkt.status}
              onChange={(e) => saveMut.mutate({ title: pkt.title, status: e.target.value, medicaid_contact_id: pkt.medicaid_contact_id, submission_reference: pkt.submission_reference, notes: pkt.notes })}>
              {["draft","ready","submitted","accepted","rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="portal-label">Medicaid billing contact</span>
            <select className="portal-input" value={pkt.medicaid_contact_id ?? ""}
              onChange={(e) => saveMut.mutate({ title: pkt.title, status: pkt.status, medicaid_contact_id: e.target.value || null, submission_reference: pkt.submission_reference, notes: pkt.notes })}>
              <option value="">— none —</option>
              {(contactsQ.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.organization ? `${c.organization} — ${c.contact_name}` : c.contact_name}</option>
              ))}
            </select>
          </label>
          <Field label="Submission reference #" v={pkt.submission_reference ?? ""} on={(v) => saveMut.mutate({ title: pkt.title, status: pkt.status, medicaid_contact_id: pkt.medicaid_contact_id, submission_reference: v, notes: pkt.notes })} />
        </div>
        <label className="block">
          <span className="portal-label">Notes</span>
          <textarea className="portal-input" rows={2} value={pkt.notes ?? ""}
            onChange={(e) => saveMut.mutate({ title: pkt.title, status: pkt.status, medicaid_contact_id: pkt.medicaid_contact_id, submission_reference: pkt.submission_reference, notes: e.target.value })} />
        </label>
      </div>

      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-extrabold tracking-tight">Packet contents</h3>
          <div className="flex gap-2">
            <button className="portal-btn-primary px-3 py-2 text-sm" onClick={() => setShowAddTrips((v) => !v)}>
              {showAddTrips ? "Hide trips" : "+ Add trips"}
            </button>
            <label className="portal-btn-primary px-3 py-2 text-sm cursor-pointer">
              {uploading ? "Uploading…" : "+ Upload trip log / doc"}
              <input type="file" className="hidden" accept=".pdf,.csv,image/*" disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const kind = f.name.toLowerCase().endsWith(".csv") ? "trip_log" : "document";
                  uploadAndAttach(f, kind);
                }} />
            </label>
          </div>
        </div>

        {showAddTrips && (
          <div className="border border-border rounded-sm p-3 max-h-80 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2">Your recent completed trips from Florida NEMT — click to add.</p>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr><th className="text-left py-1">Trip</th><th>Date</th><th>Patient</th><th>Route</th><th></th></tr>
              </thead>
              <tbody>
                {(tripsQ.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="text-center py-3 text-muted-foreground">No completed trips found.</td></tr>
                )}
                {(tripsQ.data ?? []).map((t: any) => {
                  const already = addedTripIds.has(t.id);
                  return (
                    <tr key={t.id} className="border-t border-border/40">
                      <td className="py-1 font-mono text-xs">{t.display_id ?? "—"}</td>
                      <td>{t.pickup_date} {t.pickup_time}</td>
                      <td>{t.patient_first_name} {t.patient_last_name}</td>
                      <td className="text-xs">{t.pickup_city} → {t.dropoff_city}</td>
                      <td className="text-right">
                        <button disabled={already} className="text-xs font-bold text-accent disabled:opacity-50 hover:underline"
                          onClick={() => addMut.mutate({ kind: "trip", trip_id: t.id, label: t.display_id })}>
                          {already ? "Added" : "Add"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <ul className="divide-y divide-border border-t border-border">
          {(pkt.items ?? []).length === 0 && (
            <li className="py-6 text-center text-muted-foreground text-sm">No items yet — add trips or upload trip logs / documents.</li>
          )}
          {(pkt.items ?? []).map((it: any) => (
            <li key={it.id} className="py-2 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono uppercase text-muted-foreground">{it.kind.replace("_", " ")}</div>
                {it.kind === "trip" ? (
                  <div className="font-bold">
                    {it.trips?.display_id ?? it.label} — {it.trips?.patient_first_name} {it.trips?.patient_last_name}
                    <span className="text-xs text-muted-foreground ml-2">
                      {it.trips?.pickup_date} · {it.trips?.pickup_city} → {it.trips?.dropoff_city}
                    </span>
                  </div>
                ) : (
                  <div className="font-bold truncate">{it.label ?? it.doc_path}</div>
                )}
              </div>
              <button className="text-xs font-bold text-red-600 hover:underline" onClick={() => rmMut.mutate(it.id)}>Remove</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────── Eligibility ───────────────────────

function EligibilityTab() {
  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-3">
      <h3 className="text-lg font-extrabold tracking-tight">Medicaid eligibility</h3>
      <p className="text-sm text-muted-foreground">
        Look up a patient's Medicaid plan and eligibility using their Medicaid number. Automated eligibility checks
        with AHCA are enabled per-provider — contact Florida NEMT support to activate live checks for your account.
      </p>
      <form className="grid md:grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); toast.info("Live eligibility checks are pending activation for your account."); }}>
        <Field label="Medicaid #" v="" on={() => {}} />
        <Field label="Patient last name" v="" on={() => {}} />
        <Field label="Date of birth" v="" on={() => {}} type="date" />
        <button className="portal-btn-primary col-span-3 md:col-span-1 py-2">Check eligibility</button>
      </form>
    </div>
  );
}

// ─────────────────────── Shared ───────────────────────

function Field({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="portal-label">{label}</span>
      <input className="portal-input" type={type} value={v} onChange={(e) => on(e.target.value)} />
    </label>
  );
}

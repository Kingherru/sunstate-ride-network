import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMedicaidContacts, saveMedicaidContact, deleteMedicaidContact,
  listPackets, getPacket, savePacket, deletePacket,
  addPacketItem, removePacketItem, listMyCompletedTrips,
  listPacketEvents,
  getMyMedicaidProfile, saveMyMedicaidProfile,
  checkMedicaidEligibility, listMyEligibilityChecks,
} from "@/lib/medicaid.functions";

// Status pipeline used across UI
const STATUSES = ["draft", "ready", "submitted", "awaiting_response", "approved", "rejected"] as const;
type Status = (typeof STATUSES)[number];

// File upload limits (client-side; server RLS + storage enforce the rest)
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png", "text/csv"];
const ALLOWED_EXT = [".pdf", ".jpg", ".jpeg", ".png", ".csv"];

function validateFile(file: File): string | null {
  if (file.size > MAX_UPLOAD_BYTES) return "File is larger than 15 MB.";
  const nameOk = ALLOWED_EXT.some((e) => file.name.toLowerCase().endsWith(e));
  const mimeOk = ALLOWED_MIME.includes(file.type);
  if (!nameOk && !mimeOk) return "Only PDF, JPG, PNG, or CSV files are allowed.";
  return null;
}

type Tab =
  | "packets"
  | "submitted"
  | "approved"
  | "rejected"
  | "contacts"
  | "directory"
  | "eligibility"
  | "profile";

export function MedicaidSubmissionCenter({ userId: _userId }: { userId: string }) {
  const [tab, setTab] = useState<Tab>("packets");
  const profileQ = useQuery({ queryKey: ["my-medicaid-profile"], queryFn: () => getMyMedicaidProfileFn() });
  const getMyMedicaidProfileFn = useServerFn(getMyMedicaidProfile);
  const profile: any = profileQ.data;

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent font-bold">Provider Portal</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Medicaid Submission Center</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Prepare packets, upload trip logs and supporting docs, verify Medicaid eligibility, and track submissions
          end-to-end.
        </p>
      </header>

      <div className="border border-primary/30 bg-primary/5 rounded-sm px-4 py-3 text-sm">
        <span className="font-extrabold uppercase text-xs tracking-wide text-primary">Medicaid payout policy · Net 15 · </span>
        Medicaid-funded trip payouts release on a <strong>Net-15 schedule</strong> (approximately 15 days after trip
        completion). My Florida NEMT does not receive Medicaid funds immediately from the state, so provider payouts
        for Medicaid trips are held until the corresponding Medicaid remittance has posted. All payouts are validated
        for trip completion, correct provider assignment, and payment accuracy before release. Private-pay and
        commercial trips follow the standard 48-hour validation hold.
      </div>

      {profile && !profile.medicaid_verified && (
        <div className="border border-orange-300 bg-orange-50 text-orange-800 rounded-sm px-4 py-3 text-sm">
          <span className="font-extrabold uppercase text-xs tracking-wide">Medicaid credentials required · </span>
          Your Medicaid Provider Number or NPI is missing. Medicaid-funded trips are temporarily unavailable to
          you. Private-pay and non-Medicaid trips are unaffected.
          <button className="ml-2 underline font-bold" onClick={() => setTab("profile")}>Enter Medicaid Provider # →</button>
        </div>
      )}

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {(
          [
            ["packets", "All packets"],
            ["submitted", "Submitted"],
            ["approved", "Approved"],
            ["rejected", "Denied"],
            ["eligibility", "Eligibility lookup"],
            ["contacts", "My contacts"],
            ["directory", "State directory"],
            ["profile", "Medicaid profile"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-xs md:text-sm font-bold uppercase tracking-wide border-b-2 -mb-px ${
              tab === t ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "packets" && <PacketsTab filter={null} />}
      {tab === "submitted" && <PacketsTab filter={["submitted", "awaiting_response"]} />}
      {tab === "approved" && <PacketsTab filter={["approved"]} />}
      {tab === "rejected" && <PacketsTab filter={["rejected"]} />}
      {tab === "eligibility" && <EligibilityTab />}
      {tab === "contacts" && <ContactsTab scope="mine" />}
      {tab === "directory" && <ContactsTab scope="directory" />}
      {tab === "profile" && <MedicaidProfileTab />}
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
              ? "Save billing contacts you work with. Toggle 'Share' to help other providers."
              : "Contacts other My Florida NEMT providers have shared. Read-only."}
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
            Share with statewide My Florida NEMT directory
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

      <div className="divide-y divide-border border-t border-border">
        {(q.data ?? []).length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No contacts.</p>}
        {(q.data ?? []).map((c: any) => (
          <div key={c.id} className="py-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-bold">{c.contact_name} {c.organization && <span className="text-muted-foreground font-normal">· {c.organization}</span>}</div>
              <div className="text-xs text-muted-foreground">{c.email ?? "—"} · {c.phone ?? "—"} {c.is_public && <span className="ml-2 text-accent font-bold">shared</span>}</div>
              {c.notes && <div className="text-xs mt-1">{c.notes}</div>}
            </div>
            {canEdit && (
              <div className="flex gap-3">
                <button className="text-xs font-bold text-accent" onClick={() => setEditing(c)}>Edit</button>
                <button className="text-xs font-bold text-red-600" onClick={() => confirm("Delete?") && delMut.mutate(c.id)}>Delete</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────── Packets ───────────────────────

function PacketsTab({ filter }: { filter: Status[] | null }) {
  const qc = useQueryClient();
  const list = useServerFn(listPackets);
  const save = useServerFn(savePacket);
  const del = useServerFn(deletePacket);
  const packetsQ = useQuery({ queryKey: ["medicaid-packets"], queryFn: () => list() });
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

  if (openId) return <PacketDetail id={openId} onBack={() => setOpenId(null)} />;

  const rows = (packetsQ.data ?? []).filter((p: any) => !filter || filter.includes(p.status));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold tracking-tight">
          {filter ? `${filter.map(labelForStatus).join(" / ")} packets` : "Submission packets"}
        </h3>
        {!filter && (
          <button className="portal-btn-primary px-3 py-2 text-sm" onClick={() => setCreating(true)}>+ New packet</button>
        )}
      </div>

      {creating && !filter && (
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
            <tr><th className="py-2 px-4">Title</th><th>Status</th><th>Reference #</th><th>Updated</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">
                {filter ? "No packets in this state." : "No packets yet. Create one to get started."}
              </td></tr>
            )}
            {rows.map((p: any) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-3 px-4">
                  <button className="font-bold hover:underline" onClick={() => setOpenId(p.id)}>{p.title}</button>
                </td>
                <td><StatusBadge status={p.status} /></td>
                <td className="text-xs">{p.submission_reference ?? "—"}</td>
                <td className="text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                <td className="text-right pr-4">
                  {p.status === "draft" && (
                    <button className="text-xs font-bold text-red-600 hover:underline" onClick={() => confirm("Delete packet?") && delMut.mutate(p.id)}>Delete</button>
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

function labelForStatus(s: string) {
  return ({
    draft: "Draft",
    ready: "Ready",
    submitted: "Submitted",
    awaiting_response: "Awaiting response",
    approved: "Approved",
    accepted: "Approved",
    rejected: "Denied",
  } as Record<string, string>)[s] ?? s;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    ready: "bg-accent/15 text-accent",
    submitted: "bg-blue-100 text-blue-700",
    awaiting_response: "bg-yellow-100 text-yellow-800",
    approved: "bg-emerald-100 text-emerald-700",
    accepted: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-700",
  };
  return <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-sm ${map[status] ?? map.draft}`}>{labelForStatus(status)}</span>;
}

function PacketDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const get = useServerFn(getPacket);
  const save = useServerFn(savePacket);
  const addItem = useServerFn(addPacketItem);
  const rmItem = useServerFn(removePacketItem);
  const listTrips = useServerFn(listMyCompletedTrips);
  const listContacts = useServerFn(listMedicaidContacts);
  const listEvents = useServerFn(listPacketEvents);

  const pktQ = useQuery({ queryKey: ["medicaid-packet", id], queryFn: () => get({ data: { id } }) });
  const contactsQ = useQuery({ queryKey: ["medicaid-contacts", "mine"], queryFn: () => listContacts({ data: { scope: "mine" } }) });
  const tripsQ = useQuery({ queryKey: ["my-completed-trips"], queryFn: () => listTrips() });
  const eventsQ = useQuery({ queryKey: ["medicaid-packet-events", id], queryFn: () => listEvents({ data: { packet_id: id } }) });

  const pkt: any = pktQ.data;
  const [showAddTrips, setShowAddTrips] = useState(false);
  const [uploading, setUploading] = useState(false);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["medicaid-packet", id] });
    qc.invalidateQueries({ queryKey: ["medicaid-packets"] });
    qc.invalidateQueries({ queryKey: ["medicaid-packet-events", id] });
  };

  const saveMut = useMutation({
    mutationFn: (p: any) => save({ data: { id, ...p } }),
    onSuccess: () => { invalidate(); toast.success("Saved"); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const addMut = useMutation({
    mutationFn: (payload: any) => addItem({ data: { packet_id: id, ...payload } }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const rmMut = useMutation({
    mutationFn: (itemId: string) => rmItem({ data: { id: itemId } }),
    onSuccess: invalidate,
  });

  async function uploadAndAttach(file: File, kind: "trip_log" | "document") {
    const err = validateFile(file);
    if (err) { toast.error(err); return; }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Not signed in");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const docId = crypto.randomUUID();
      const path = `packets/${uid}/${id}/${docId}.${ext}`;
      const { error } = await supabase.storage.from("provider-docs").upload(path, file, { contentType: file.type || undefined });
      if (error) throw error;
      await addMut.mutateAsync({ kind, doc_path: path, label: file.name, meta: { size: file.size, mime: file.type } });
      toast.success(`${file.name} uploaded and attached`);
    } catch (e: any) { toast.error(e.message ?? "Upload failed"); }
    finally { setUploading(false); }
  }

  const addedTripIds = useMemo(
    () => new Set((pkt?.items ?? []).filter((i: any) => i.kind === "trip").map((i: any) => i.trip_id)),
    [pkt],
  );

  if (pktQ.isLoading) return <div className="text-sm text-muted-foreground">Loading packet…</div>;
  if (!pkt) return <div className="text-sm">Packet not found. <button onClick={onBack} className="text-accent underline">Back</button></div>;

  const patch = (over: any) => saveMut.mutate({
    title: pkt.title, status: pkt.status, medicaid_contact_id: pkt.medicaid_contact_id,
    submission_reference: pkt.submission_reference, notes: pkt.notes, ...over,
  });

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm font-bold text-accent hover:underline">← Back to packets</button>

      <div className="bg-card border border-border rounded-sm p-6 space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <Field label="Title" v={pkt.title} on={(v) => patch({ title: v })} />
          <label className="block">
            <span className="portal-label">Status</span>
            <select className="portal-input" value={pkt.status}
              onChange={(e) => patch({ status: e.target.value })}>
              {STATUSES.map((s) => <option key={s} value={s}>{labelForStatus(s)}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="portal-label">Medicaid billing contact</span>
            <select className="portal-input" value={pkt.medicaid_contact_id ?? ""}
              onChange={(e) => patch({ medicaid_contact_id: e.target.value || null })}>
              <option value="">— none —</option>
              {(contactsQ.data ?? []).map((c: any) => (
                <option key={c.id} value={c.id}>{c.organization ? `${c.organization} — ${c.contact_name}` : c.contact_name}</option>
              ))}
            </select>
          </label>
          <Field label="Submission reference #" v={pkt.submission_reference ?? ""} on={(v) => patch({ submission_reference: v })} />
        </div>
        <label className="block">
          <span className="portal-label">Notes</span>
          <textarea className="portal-input" rows={2} value={pkt.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value })} />
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
              <input type="file" className="hidden" accept=".pdf,.csv,.jpg,.jpeg,.png" disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const kind = f.name.toLowerCase().endsWith(".csv") ? "trip_log" : "document";
                  uploadAndAttach(f, kind);
                }} />
            </label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Accepted: PDF, JPG, PNG, CSV · max 15&nbsp;MB per file.
        </p>

        {showAddTrips && (
          <div className="border border-border rounded-sm p-3 max-h-80 overflow-auto">
            <p className="text-xs text-muted-foreground mb-2">Your recent completed trips — click to add.</p>
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

      {/* Audit history */}
      <div className="bg-card border border-border rounded-sm p-6">
        <h3 className="text-lg font-extrabold tracking-tight mb-2">Submission history</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Full audit trail of every change, upload, and status transition for this packet.
        </p>
        <ol className="space-y-2">
          {(eventsQ.data ?? []).length === 0 && <li className="text-sm text-muted-foreground">No events yet.</li>}
          {(eventsQ.data ?? []).map((e: any) => (
            <li key={e.id} className="text-sm border-l-2 border-border pl-3">
              <div className="font-bold">
                {formatEventAction(e)}
                {e.actor_display_id && <span className="text-xs font-mono text-muted-foreground ml-2">by {e.actor_display_id}</span>}
              </div>
              <div className="text-xs text-muted-foreground">
                {new Date(e.created_at).toLocaleString()}
              </div>
              {e.metadata && Object.keys(e.metadata).length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {e.metadata.label ?? e.metadata.title ?? e.metadata.submission_reference ?? ""}
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function formatEventAction(e: any) {
  if (e.action === "status_changed") return `Status: ${labelForStatus(e.from_status)} → ${labelForStatus(e.to_status)}`;
  if (e.action === "created") return `Packet created (${labelForStatus(e.to_status ?? "draft")})`;
  if (e.action === "item_added") return `Added ${e.metadata?.kind ?? "item"}`;
  if (e.action === "item_removed") return `Removed ${e.metadata?.kind ?? "item"}`;
  return e.action;
}

// ─────────────────────── Medicaid Profile ───────────────────────

function MedicaidProfileTab() {
  const qc = useQueryClient();
  const get = useServerFn(getMyMedicaidProfile);
  const save = useServerFn(saveMyMedicaidProfile);
  const q = useQuery({ queryKey: ["my-medicaid-profile"], queryFn: () => get() });
  const p: any = q.data ?? {};
  const [form, setForm] = useState<any>({});

  const merged = { ...p, ...form };

  const saveMut = useMutation({
    mutationFn: (payload: any) => save({ data: payload }),
    onSuccess: (r: any) => {
      toast.success(r.verified ? "Saved — Medicaid verified" : "Saved");
      qc.invalidateQueries({ queryKey: ["my-medicaid-profile"] });
      setForm({});
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className={`bg-card border rounded-sm p-6 space-y-4 ${merged.medicaid_verified ? "border-emerald-300" : "border-orange-300"}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight">Medicaid profile</h3>
            <p className="text-xs text-muted-foreground">
              Providers can register without a Medicaid Provider Number, but Medicaid-funded trips will not be
              assigned until your Medicaid Provider Number and NPI are on file. Private-pay assignments are
              unaffected. Medicaid does not issue a tracked certification document — no upload required.
            </p>
          </div>
          <span className={`text-xs font-extrabold uppercase px-3 py-1 rounded-sm ${
            merged.medicaid_verified ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-800"
          }`}>{merged.medicaid_verified ? "Verified" : "Not verified"}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="Medicaid Provider Number" v={merged.medicaid_number ?? ""} on={(v) => setForm({ ...form, medicaid_number: v })} placeholder="Required for Medicaid-funded trips" />
          <Field label="NPI Number (10 digits)" v={merged.npi ?? ""} on={(v) => setForm({ ...form, npi: v })} placeholder="Required for Medicaid-funded trips" />
          <Field label="Medicaid plan (e.g. Sunshine Health)" v={merged.medicaid_plan ?? ""} on={(v) => setForm({ ...form, medicaid_plan: v })} />
        </div>

        <label className="flex items-start gap-2 text-sm border-t border-border pt-3">
          <input type="checkbox" className="mt-1" checked={!!merged.allow_live_medicaid_verification}
            onChange={(e) => setForm({ ...form, allow_live_medicaid_verification: e.target.checked })} />
          <span>
            <span className="font-bold">Allow Live Medicaid Verification</span> — enable real-time AHCA / Sunshine
            Health eligibility lookups on this account. Requires a verified Medicaid Provider Number.
          </span>
        </label>

        <div className="flex gap-2 pt-2">
          <button className="portal-btn-primary px-4 py-2 text-sm" disabled={saveMut.isPending || Object.keys(form).length === 0}
            onClick={() => saveMut.mutate(form)}>{saveMut.isPending ? "Saving…" : "Save Medicaid profile"}</button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-sm p-4">
        <div className="font-bold uppercase tracking-wide text-[10px] mb-1 text-foreground">Roadmap</div>
        Sunshine Health, Availity, and AHCA integrations for live eligibility, one-click packet generation, automatic
        document population from trip records, automated email delivery, submission confirmations, reminder
        notifications, insurance / broker submission workflows, and direct Medicaid payout deposits are on the roadmap.
      </div>
    </div>
  );
}

// ─────────────────────── Eligibility ───────────────────────

function EligibilityTab() {
  const check = useServerFn(checkMedicaidEligibility);
  const list = useServerFn(listMyEligibilityChecks);
  const qc = useQueryClient();
  const historyQ = useQuery({ queryKey: ["medicaid-eligibility-history"], queryFn: () => list() });
  const [form, setForm] = useState({ medicaid_number: "", patient_last_name: "", patient_dob: "" });

  const mut = useMutation({
    mutationFn: () => check({ data: form }),
    onSuccess: (r: any) => {
      toast.success(`Lookup logged: ${r.result_status}`);
      qc.invalidateQueries({ queryKey: ["medicaid-eligibility-history"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Lookup failed"),
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-sm p-6 space-y-3">
        <h3 className="text-lg font-extrabold tracking-tight">Medicaid eligibility lookup</h3>
        <p className="text-sm text-muted-foreground">
          Enter a member's Medicaid number to check current eligibility before assembling a packet. Enable
          <span className="font-bold"> Allow Live Medicaid Verification </span> on your Medicaid profile to use the
          real-time AHCA / Sunshine Health endpoint (integration pending activation).
        </p>
        <form className="grid md:grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); mut.mutate(); }}>
          <Field label="Medicaid # *" v={form.medicaid_number} on={(v) => setForm({ ...form, medicaid_number: v })} />
          <Field label="Patient last name" v={form.patient_last_name} on={(v) => setForm({ ...form, patient_last_name: v })} />
          <Field label="Date of birth" v={form.patient_dob} on={(v) => setForm({ ...form, patient_dob: v })} type="date" />
          <button className="portal-btn-primary col-span-3 md:col-span-1 py-2" disabled={mut.isPending}>
            {mut.isPending ? "Checking…" : "Check eligibility"}
          </button>
        </form>
      </div>

      <div className="bg-card border border-border rounded-sm p-6">
        <h4 className="text-sm font-extrabold uppercase tracking-wide mb-2">Recent lookups</h4>
        <ul className="divide-y divide-border">
          {(historyQ.data ?? []).length === 0 && <li className="py-4 text-sm text-muted-foreground">No lookups yet.</li>}
          {(historyQ.data ?? []).map((r: any) => (
            <li key={r.id} className="py-2 flex items-center justify-between gap-3 text-sm">
              <div>
                <div className="font-mono font-bold">{r.medicaid_number}</div>
                <div className="text-xs text-muted-foreground">
                  {r.patient_last_name ?? "—"} · {r.patient_dob ?? "—"} · {new Date(r.created_at).toLocaleString()}
                </div>
              </div>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded-sm bg-muted text-muted-foreground">{r.result_status}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─────────────────────── Shared ───────────────────────

function Field({ label, v, on, type = "text", placeholder }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="portal-label">{label}</span>
      <input className="portal-input" type={type} value={v} placeholder={placeholder} onChange={(e) => on(e.target.value)} />
    </label>
  );
}

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { getMyNetworkProfile, saveNetworkProfile } from "@/lib/facility-providers.functions";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import { DsField, DsInput } from '@/components/ds/controls';

function ListEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v || values.includes(v)) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="flex-1 border border-border rounded-sm px-3 py-2 text-sm"
        />
        <button type="button" onClick={add} className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted">Add</button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 text-xs font-bold bg-muted px-2 py-1 rounded-sm">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}><X className="size-3" /></button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function NetworkProfileForm({ workspaceId }: { workspaceId: string }) {
  const preview = usePortalPreview();
  const qc = useQueryClient();
  const getFn = useServerFn(getMyNetworkProfile);
  const saveFn = useServerFn(saveNetworkProfile);

  const q = usePortalQuery({
    queryKey: ["my-network-profile", workspaceId],
    queryFn: () => getFn({ data: { workspace_id: workspaceId } }),
  });

  const [description, setDescription] = useState("");
  const [serviceBase, setServiceBase] = useState('');
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceTypes, setServiceTypes] = useState<string[]>([]);
  const [counties, setCounties] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [zips, setZips] = useState<string[]>([]);
  const [hours, setHours] = useState("");
  const [medicalDelivery, setMedicalDelivery] = useState(false);
  const [accepting, setAccepting] = useState(true);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q.data?.ok) return;
    const p = q.data.profile;
    if (!p) return;
    setDescription(p.description ?? "");
    setServiceBase(p.service_base_address ?? '');
    setEmail(p.business_contact_email ?? "");
    setPhone(p.business_contact_phone ?? "");
    setServiceTypes(p.service_types ?? []);
    setCounties(p.counties ?? []);
    setCities(p.cities ?? []);
    setZips(p.zips ?? []);
    setHours(p.hours ?? "");
    setMedicalDelivery(!!p.medical_delivery);
    setAccepting(p.accepting_connections ?? true);
    setVisible(!!p.visible);
  }, [q.data]);

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (q.data && !q.data.ok) return <div className="text-sm text-destructive">{q.data.error}</div>;

  const verified = q.data && q.data.ok ? q.data.verified : false;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (preview.active) { previewBlocked(); return; }
    setBusy(true);
    try {
      const r = await saveFn({
        data: {
          workspace_id: workspaceId,
          service_base_address: serviceBase || null,
          description: description || null,
          business_contact_email: email || null,
          business_contact_phone: phone || null,
          service_types: serviceTypes,
          counties,
          cities,
          zips,
          hours: hours || null,
          medical_delivery: medicalDelivery,
          accepting_connections: accepting,
          visible,
        },
      });
      if (!r.ok) { toast.error(r.error); return; }
      toast.success("Network profile saved");
      qc.invalidateQueries({ queryKey: ["my-network-profile", workspaceId] });
      qc.invalidateQueries({ queryKey: ["network-providers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSave} className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">Network profile</h2>
          <p className="text-sm text-muted-foreground">Controls what other accounts see about you in the Provider Network directory.</p>
        </div>
        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-sm border inline-flex items-center gap-1 ${verified ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-border text-muted-foreground"}`}>
          <CheckCircle2 className="size-3" /> {verified ? "Verified" : "Not verified"}
        </span>
      </div>

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000}
          className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
      </label>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Business contact email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254}
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Business contact phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={32}
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
        </label>
      </div>

      <ListEditor label="Service types" values={serviceTypes} onChange={setServiceTypes} placeholder="e.g. Wheelchair van" />
      <DsField label="Service-base location" hint="Distance offers require verified base coordinates and approved transportation capabilities.">{p=><DsInput {...p} maxLength={300} value={serviceBase} onChange={e=>setServiceBase(e.target.value)} />}</DsField>
      <ListEditor label="Counties served" values={counties} onChange={setCounties} placeholder="e.g. Duval" />
      <ListEditor label="Cities served" values={cities} onChange={setCities} placeholder="e.g. Jacksonville" />
      <ListEditor label="ZIP codes served" values={zips} onChange={setZips} placeholder="e.g. 32256" />

      <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hours</span>
        <input value={hours} onChange={(e) => setHours(e.target.value)} maxLength={500}
          className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={medicalDelivery} onChange={(e) => setMedicalDelivery(e.target.checked)} /> Medical delivery
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} /> Accepting connections
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible in Provider Network
        </label>
      </div>

      <button type="submit" disabled={busy} className="bg-accent text-accent-foreground font-bold text-sm px-4 py-2 rounded-sm hover:bg-accent/90 disabled:opacity-50">
        {busy ? "Saving…" : "Save network profile"}
      </button>
    </form>
  );
}

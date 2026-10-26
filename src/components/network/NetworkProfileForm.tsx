import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { getMyNetworkProfile, saveNetworkProfile } from "@/lib/facility-providers.functions";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import { DsButton, DsField, DsInput } from '@/components/ds/controls';
import { AddressAutocomplete } from '@/components/forms/AddressAutocomplete';

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

export function NetworkProfileForm({ workspaceId, section = 'all' }: { workspaceId: string; section?: 'all' | 'contact' | 'services' | 'areas' }) {
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
  const [locationCity, setLocationCity] = useState('');
  const [locationCounty, setLocationCounty] = useState('');
  const [locationZip, setLocationZip] = useState('');
  const [radius, setRadius] = useState('');
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [centerText, setCenterText] = useState('');
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
    setLocationCity(p.location_city ?? ''); setLocationCounty(p.location_county ?? ''); setLocationZip(p.location_zip ?? ''); setRadius(p.service_radius_miles == null ? '' : String(p.service_radius_miles));
    setCenter(p.public_center_lat != null && p.public_center_lng != null ? { lat: p.public_center_lat, lng: p.public_center_lng } : null);
    setCenterText([p.location_city, p.location_zip].filter(Boolean).join(', '));
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
          location_city: locationCity || null, location_county: locationCounty || null, location_zip: locationZip || null,
          service_radius_miles: radius ? Number(radius) : null, public_center_lat: center?.lat ?? null, public_center_lng: center?.lng ?? null,
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
          <h2 className="ds-subheading uppercase text-ds-primary">{section === 'contact' ? 'Contact information' : section === 'services' ? 'Services & operating hours' : section === 'areas' ? 'Service areas' : 'Network profile'}</h2>
          <p className="text-sm text-muted-foreground">Controls what other accounts see about you in the Provider Network directory.</p>
        </div>
        <span className={`ds-caption px-2 py-1 rounded-ds-sm border inline-flex items-center gap-1 ${verified ? 'border-ds-sky-border bg-ds-sky text-ds-primary' : 'border-ds-border text-ds-text-2'}`}>
          <CheckCircle2 className="size-3" /> {verified ? "Verified" : "Not verified"}
        </span>
      </div>

      {(section === 'all') && <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000}
          className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
      </label>}

      {(section === 'all' || section === 'contact') && <div className="grid sm:grid-cols-2 gap-4">
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
      </div>}

      {(section === 'all' || section === 'services') && <ListEditor label="Service types" values={serviceTypes} onChange={setServiceTypes} placeholder="ambulatory, wheelchair or stretcher" />}
      {(section === 'all' || section === 'areas') && <>
      <DsField label="Private service-base location" hint="Not shown in the directory; controlled distance offers retain verified-base requirements.">{p=><DsInput {...p} maxLength={300} value={serviceBase} onChange={e=>setServiceBase(e.target.value)} />}</DsField>
      <div className="grid gap-4 sm:grid-cols-2">
        <DsField label="City">{p => <DsInput {...p} value={locationCity} maxLength={100} onChange={e => setLocationCity(e.target.value)} />}</DsField>
        <DsField label="County">{p => <DsInput {...p} value={locationCounty} maxLength={100} onChange={e => setLocationCounty(e.target.value)} />}</DsField>
        <DsField label="ZIP code">{p => <DsInput {...p} value={locationZip} maxLength={5} pattern="[0-9]{5}" onChange={e => setLocationZip(e.target.value)} />}</DsField>
        <DsField label="Service radius (miles)">{p => <DsInput {...p} value={radius} type="number" min={0} onChange={e => setRadius(e.target.value)} />}</DsField>
      </div>
      <DsField label="Public service-area center" hint="Use a city, ZIP or public business location, never a private home address. Only the service center is used for proximity.">{p => <AddressAutocomplete inputId={p.id} value={centerText} onChange={v => { setCenterText(v); setCenter(null); }} onSelect={v => { setCenterText(v.fullAddress); setLocationCity(v.city); setLocationCounty(v.county.replace(/ County$/i, '')); setLocationZip(v.zip); setCenter(v.lat != null && v.lng != null ? { lat: v.lat, lng: v.lng } : null); }} />}</DsField>
      <p className="ds-caption">{center ? 'Public service-center coordinates available.' : 'No public service-center coordinates saved.'}</p>
      <ListEditor label="Counties served" values={counties} onChange={setCounties} placeholder="e.g. Duval" />
      <ListEditor label="Cities served" values={cities} onChange={setCities} placeholder="e.g. Jacksonville" />
      <ListEditor label="ZIP codes served" values={zips} onChange={setZips} placeholder="e.g. 32256" />
      </>}

      {(section === 'all' || section === 'services') && <label className="block">
        <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Hours</span>
        <input value={hours} onChange={(e) => setHours(e.target.value)} maxLength={500}
          className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm" />
      </label>}

      {(section === 'all' || section === 'services') && <div className="flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={medicalDelivery} onChange={(e) => setMedicalDelivery(e.target.checked)} /> Medical delivery
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} /> Accepting connections
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} /> Visible in Provider Network
        </label>
      </div>}

      <DsButton type="submit" size="sm" disabled={busy}>
        {busy ? "Saving…" : "Save network profile"}
      </DsButton>
    </form>
  );
}

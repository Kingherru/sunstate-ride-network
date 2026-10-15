import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, MapPin, BookmarkPlus, BookmarkCheck, Phone, Mail, Truck, CheckCircle2 } from "lucide-react";
import {
  listNetworkProviders,
  saveNetworkProvider,
  unsaveNetworkProvider,
  type NetworkProviderRow,
} from "@/lib/facility-providers.functions";

export function ProviderDirectory({ savedOnly = false }: { savedOnly?: boolean }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listNetworkProviders);
  const saveFn = useServerFn(saveNetworkProvider);
  const unsaveFn = useServerFn(unsaveNetworkProvider);

  const [search, setSearch] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [county, setCounty] = useState("");
  const [city, setCity] = useState("");
  const [zip, setZip] = useState("");
  const [medicalDelivery, setMedicalDelivery] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const filters = {
    search: search.trim() || undefined,
    service_type: serviceType.trim() || undefined,
    county: county.trim() || undefined,
    city: city.trim() || undefined,
    zip: zip.trim() || undefined,
    medical_delivery: medicalDelivery || undefined,
    accepting: accepting || undefined,
    saved_only: savedOnly,
  };

  const q = useQuery({
    queryKey: ["network-providers", filters],
    queryFn: async () => {
      const r = await listFn({ data: filters });
      if (!r.ok) throw new Error(r.error);
      return r.results;
    },
  });

  async function toggleSave(row: NetworkProviderRow) {
    try {
      if (row.is_saved) {
        await unsaveFn({ data: { provider_workspace_id: row.workspace_id } });
        toast.success("Removed from saved");
      } else {
        await saveFn({ data: { provider_workspace_id: row.workspace_id } });
        toast.success("Saved to your providers");
      }
      qc.invalidateQueries({ queryKey: ["network-providers"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      {!savedOnly && (
        <div className="bg-card border border-border rounded-sm p-4 space-y-3">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Name">
              <div className="relative">
                <Search className="pointer-events-none size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Business name" style={{ paddingLeft: "2.5rem" }}
                  className="w-full border border-border rounded-sm pl-8 pr-3 py-2 text-sm" />
              </div>
            </Field>
            <Field label="Service type"><input value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm" /></Field>
            <Field label="County"><input value={county} onChange={(e) => setCounty(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm" /></Field>
            <Field label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className="w-full border border-border rounded-sm px-3 py-2 text-sm" /></Field>
            <Field label="ZIP"><input value={zip} onChange={(e) => setZip(e.target.value)} maxLength={10} className="w-full border border-border rounded-sm px-3 py-2 text-sm" /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={medicalDelivery} onChange={(e) => setMedicalDelivery(e.target.checked)} /> Medical delivery
            </label>
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              <input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} /> Accepting connections
            </label>
          </div>
          <p className="text-xs text-muted-foreground italic">Distance search isn't available yet — search by county, city or ZIP instead.</p>
        </div>
      )}

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!q.isLoading && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
          {savedOnly ? "No saved providers yet. Use Find providers to search the network and save the ones you want." : "No network providers match these filters yet."}
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.workspace_id} className="bg-card border border-border rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-extrabold flex items-center gap-2 flex-wrap">
                  {r.business_name}
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm border border-border inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Verified
                  </span>
                  {r.medical_delivery && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-muted text-foreground inline-flex items-center gap-1">
                      <Truck className="size-3" /> Medical delivery
                    </span>
                  )}
                  {!r.accepting_connections && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-muted text-foreground">Not accepting</span>
                  )}
                </div>
                {r.description && <div className="text-xs text-foreground mt-1 max-w-2xl">{r.description}</div>}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  {(r.cities.length > 0 || r.counties.length > 0) && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" /> {[...r.cities, ...r.counties].slice(0, 4).join(", ") || "—"}
                    </span>
                  )}
                  {r.business_contact_phone && (
                    <a href={`tel:${r.business_contact_phone}`} className="inline-flex items-center gap-1 font-bold text-foreground hover:underline"><Phone className="size-3" /> {r.business_contact_phone}</a>
                  )}
                  {r.business_contact_email && (
                    <a href={`mailto:${r.business_contact_email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3" /> {r.business_contact_email}</a>
                  )}
                </div>
                {r.service_types.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Services: {r.service_types.join(", ")}</div>
                )}
                {r.hours && <div className="text-xs text-muted-foreground mt-1">Hours: {r.hours}</div>}
              </div>
              <button
                onClick={() => toggleSave(r)}
                className={`text-xs font-bold px-3 py-2 rounded-sm inline-flex items-center gap-2 shrink-0 ${r.is_saved ? "border border-border hover:bg-muted" : "bg-accent text-accent-foreground hover:bg-accent/90"}`}
              >
                {r.is_saved ? <><BookmarkCheck className="size-4" /> Saved</> : <><BookmarkPlus className="size-4" /> Save</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

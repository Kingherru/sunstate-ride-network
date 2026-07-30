import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Search, MapPin, BookmarkPlus, BookmarkCheck, Trash2, Phone, Mail } from "lucide-react";
import {
  findProvidersNearAddress,
  listSavedProviders,
  saveProvider,
  unsaveProvider,
  type ProviderLookupRow,
} from "@/lib/facility-providers.functions";

type Mode = "lookup" | "saved";

export function FacilityProvidersPanel({ initialMode = "lookup" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Providers</h2>
        <p className="text-sm text-muted-foreground">
          Look up NEMT providers within 50 miles of a pickup address. Save the ones you trust to your subscribed list.
        </p>
      </div>
      <div className="flex gap-2 border-b border-border">
        {(["lookup", "saved"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px ${mode === m ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            {m === "lookup" ? "Find providers" : "Saved providers"}
          </button>
        ))}
      </div>
      {mode === "lookup" ? <LookupTab /> : <SavedTab />}
    </div>
  );
}

function LookupTab() {
  const qc = useQueryClient();
  const find = useServerFn(findProvidersNearAddress);
  const save = useServerFn(saveProvider);
  const unsave = useServerFn(unsaveProvider);
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(50);
  const [results, setResults] = useState<ProviderLookupRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setBusy(true);
    try {
      const r = await find({ data: { address: address.trim(), radius_miles: radius } });
      if (!r.ok) {
        toast.error(r.error === "geocode_failed" ? "Could not find that address" : r.error);
        setResults([]);
      } else {
        setResults(r.results);
        if (r.results.length === 0) toast.message(`No providers within ${radius} miles.`);
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: ProviderLookupRow) {
    try {
      if (row.is_saved) {
        await unsave({ data: { provider_user_id: row.user_id } });
        toast.success("Removed from saved");
      } else {
        await save({ data: { provider_user_id: row.user_id } });
        toast.success("Saved to your providers");
      }
      setResults((prev) => prev?.map((p) => (p.user_id === row.user_id ? { ...p, is_saved: !p.is_saved } : p)) ?? null);
      qc.invalidateQueries({ queryKey: ["facility-saved-providers"] });
      qc.invalidateQueries({ queryKey: ["facility-saved-ids"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search} className="bg-card border border-border rounded-sm p-4 grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pickup ZIP code or address</span>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 32256 or 123 Main St, Jacksonville, FL"
            className="mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Radius</span>
          <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} className="mt-1 border border-border rounded-sm px-3 py-2 text-sm">
            {[10, 25, 50, 75, 100].map((m) => (
              <option key={m} value={m}>{m} mi</option>
            ))}
          </select>
        </label>
        <button type="submit" disabled={busy} className="bg-accent text-accent-foreground font-bold text-sm px-4 py-2 rounded-sm hover:bg-accent/90 disabled:opacity-50 inline-flex items-center gap-2">
          <Search className="size-4" /> {busy ? "Searching…" : "Search"}
        </button>
      </form>

      {results && results.length > 0 && (
        <div className="space-y-2">
          {results.map((r) => (
            <div key={r.user_id} className="bg-card border border-border rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-extrabold flex items-center gap-2 flex-wrap">
                  {r.company_name ?? (`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Provider")}
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm bg-muted text-foreground">
                    {r.match_type === "zip"
                      ? "Services this ZIP"
                      : r.match_type === "zone"
                        ? `Serves ${r.zone_name ?? "this zone"}`
                        : "Long-distance"}
                  </span>
                  {r.medicaid_verified && (
                    <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-sm border border-border">Medicaid verified</span>
                  )}
                </div>
                {r.company_name && (`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()) && (
                  <div className="text-xs text-foreground mt-1">{`${r.first_name ?? ""} ${r.last_name ?? ""}`.trim()}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {r.city ?? "—"}{r.region ? ` · ${r.region}` : ""}{r.postal_code ? ` ${r.postal_code}` : ""}</span>
                  {r.phone && (
                    <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 font-bold text-foreground hover:underline"><Phone className="size-3" /> {r.phone}</a>
                  )}
                  {r.dispatch_email && (
                    <a href={`mailto:${r.dispatch_email}`} className="inline-flex items-center gap-1 hover:underline"><Mail className="size-3" /> {r.dispatch_email}</a>
                  )}
                  {r.distance_miles != null && <span><span className="font-bold text-foreground">{r.distance_miles} mi</span> from pickup</span>}
                  {r.est_fare_low_cents != null && r.est_fare_high_cents != null && (
                    <span className="font-bold text-foreground">Est. ${(r.est_fare_low_cents / 100).toFixed(0)}–${(r.est_fare_high_cents / 100).toFixed(0)}</span>
                  )}
                  {r.service_radius_miles != null && <span>Service radius: {r.service_radius_miles} mi</span>}
                </div>
              </div>
              <button
                onClick={() => toggle(r)}
                className={`text-xs font-bold px-3 py-2 rounded-sm inline-flex items-center gap-2 shrink-0 ${r.is_saved ? "border border-border hover:bg-muted" : "bg-accent text-accent-foreground hover:bg-accent/90"}`}
              >
                {r.is_saved ? <><BookmarkCheck className="size-4" /> Saved</> : <><BookmarkPlus className="size-4" /> Save provider</>}
              </button>
            </div>
          ))}
        </div>
      )}
      {results && results.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">No approved, active providers service that ZIP code yet. Try a nearby ZIP or widen the radius.</div>
      )}
    </div>
  );
}


function SavedTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSavedProviders);
  const unsave = useServerFn(unsaveProvider);
  const q = useQuery({
    queryKey: ["facility-saved-providers"],
    queryFn: () => listFn(),
  });
  const rows = (q.data ?? []) as any[];

  async function remove(provider_user_id: string) {
    try {
      await unsave({ data: { provider_user_id } });
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["facility-saved-providers"] });
      qc.invalidateQueries({ queryKey: ["facility-saved-ids"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    }
  }

  if (q.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (rows.length === 0)
    return (
      <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
        No saved providers yet. Use <strong>Find providers</strong> to search by pickup address and save the ones you want to subscribe to.
      </div>
    );

  return (
    <div className="space-y-2">
      {rows.map((s) => {
        const p = s.profile ?? {};
        return (
          <div key={s.id} className="bg-card border border-border rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="font-extrabold">{p.company_name ?? (`${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Provider")}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                {p.city && <span className="inline-flex items-center gap-1"><MapPin className="size-3" /> {p.city}{p.region ? ` · ${p.region}` : ""}</span>}
                {p.phone && <span>{p.phone}</span>}
                {p.dispatch_email && <span>{p.dispatch_email}</span>}
              </div>
              {s.notes && <div className="text-xs text-muted-foreground mt-1 italic">"{s.notes}"</div>}
            </div>
            <button
              onClick={() => remove(s.provider_user_id)}
              className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted inline-flex items-center gap-2 shrink-0"
            >
              <Trash2 className="size-4" /> Remove
            </button>
          </div>
        );
      })}
    </div>
  );
}

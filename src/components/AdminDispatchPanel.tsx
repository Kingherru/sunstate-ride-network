import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listDispatchZones,
  listZoneZips,
  assignZipsToZone,
  removeZipFromZone,
  listTripsByZone,
  listDispatchZoneStats,
} from "@/lib/dispatch.functions";
import { listAllSchedules } from "@/lib/schedules.functions";
import {
  globalSearchById,
  adminAssignTrip,
  adminCancelTrip,
  listProvidersForZone,
} from "@/lib/system-ids.functions";
import { suggestProvidersForTrip, offerTripPriority } from "@/lib/assignment.functions";
import { useCapabilities, permissionMessage } from "@/lib/permissions";

export function AdminDispatchPanel() {
  const caps = useCapabilities();
  const qc = useQueryClient();
  const zonesFn = useServerFn(listDispatchZones);
  const zipsFn = useServerFn(listZoneZips);
  const assignFn = useServerFn(assignZipsToZone);
  const removeFn = useServerFn(removeZipFromZone);
  const searchFn = useServerFn(globalSearchById);
  const tripsFn = useServerFn(listTripsByZone);
  const schedFn = useServerFn(listAllSchedules);
  const providersFn = useServerFn(listProvidersForZone);
  const assignTripFn = useServerFn(adminAssignTrip);
  const cancelTripFn = useServerFn(adminCancelTrip);

  const statsFn = useServerFn(listDispatchZoneStats);
  const zonesQ = useQuery({ queryKey: ["disp", "zones"], queryFn: () => zonesFn() });
  const zipsQ = useQuery({ queryKey: ["disp", "zips"], queryFn: () => zipsFn() });
  const statsQ = useQuery({ queryKey: ["disp", "stats"], queryFn: () => statsFn() });

  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [zipInput, setZipInput] = useState("");
  const [tripQuery, setTripQuery] = useState("");
  const [foundTrip, setFoundTrip] = useState<any>(null);
  const [searchResult, setSearchResult] = useState<{ kind: string | null; record: any } | null>(null);

  const tripsQ = useQuery({
    queryKey: ["disp", "trips", activeZoneId],
    enabled: !!activeZoneId,
    queryFn: () => tripsFn({ data: { zone_id: activeZoneId! } }),
  });

  const schedQ = useQuery({
    queryKey: ["disp", "schedules"],
    queryFn: () => schedFn({ data: {} }),
  });

  const mAssign = useMutation({
    mutationFn: (v: { zone_id: string; zips: string[] }) => assignFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`Assigned ${r.count} ZIP${r.count === 1 ? "" : "s"}`);
      setZipInput("");
      qc.invalidateQueries({ queryKey: ["disp"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const mRemove = useMutation({
    mutationFn: (zip: string) => removeFn({ data: { zip } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["disp"] }),
  });

  function handleAssign() {
    if (!activeZoneId) return toast.error("Pick a zone first");
    const zips = Array.from(new Set(
      zipInput.split(/[\s,;]+/).map((s) => s.trim()).filter((s) => /^\d{5}$/.test(s))
    ));
    if (zips.length === 0) return toast.error("Enter one or more 5-digit ZIPs");
    mAssign.mutate({ zone_id: activeZoneId, zips });
  }

  async function handleFindTrip() {
    const q = tripQuery.trim();
    if (!q) return;
    const r = await searchFn({ data: { id: q } });
    setSearchResult(r);
    if (r.kind === "trip") setFoundTrip(r.record); else setFoundTrip(null);
    if (!r.kind) toast.error("No record found for that ID");
  }

  const mReassign = useMutation({
    mutationFn: (v: { trip_id: string; assigned_to: string | null }) => assignTripFn({ data: v }),
    onSuccess: () => {
      toast.success("Trip assignment updated");
      qc.invalidateQueries({ queryKey: ["disp", "trips"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const mCancelTrip = useMutation({
    mutationFn: (trip_id: string) => cancelTripFn({ data: { trip_id } }),
    onSuccess: () => {
      toast.success("Trip canceled");
      qc.invalidateQueries({ queryKey: ["disp", "trips"] });
    },
  });

  const zones = zonesQ.data ?? [];
  const zips = zipsQ.data ?? [];
  const zipsByZone = new Map<string, string[]>();
  zips.forEach((z: any) => {
    if (!zipsByZone.has(z.zone_id)) zipsByZone.set(z.zone_id, []);
    zipsByZone.get(z.zone_id)!.push(z.zip);
  });

  return (
    <div className="space-y-8">
      {/* Global ID lookup */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-lg font-extrabold tracking-tight mb-3">Find by System ID</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Search any record: <span className="font-mono">TRP-</span> (trip),{" "}
          <span className="font-mono">FLNP-</span> (provider),{" "}
          <span className="font-mono">PAT-</span> (patient),{" "}
          <span className="font-mono">FAC-</span> (facility),{" "}
          <span className="font-mono">STF-</span> (staff).
        </p>
        <div className="flex gap-2">
          <input
            placeholder="TRP-000123"
            value={tripQuery}
            onChange={(e) => setTripQuery(e.target.value)}
            className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono"
          />
          <button onClick={handleFindTrip} className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-sm">
            Find
          </button>
        </div>
        {foundTrip && (
          <div className="mt-3 text-sm bg-background/40 border border-border rounded-sm p-3">
            <div className="font-mono font-bold">{foundTrip.display_id}</div>
            <div>{foundTrip.patient_first_name} {foundTrip.patient_last_name} · {foundTrip.pickup_date} {String(foundTrip.pickup_time).slice(0, 5)}</div>
            <div className="text-xs text-muted-foreground">{foundTrip.pickup_address}, {foundTrip.pickup_city} {foundTrip.pickup_zip ?? ""} → {foundTrip.dropoff_address}, {foundTrip.dropoff_city}</div>
            <div className="text-xs mt-1">Status: <strong>{foundTrip.status}</strong> · Zone: {zones.find((z: any) => z.id === foundTrip.dispatch_zone_id)?.name ?? "—"}</div>
          </div>
        )}
        {searchResult?.kind && searchResult.kind !== "trip" && (
          <div className="mt-3 text-sm bg-background/40 border border-border rounded-sm p-3">
            <div className="font-mono font-bold">{searchResult.record?.display_id}</div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{searchResult.kind}</div>
            <div className="mt-1">
              {searchResult.record?.company_name ?? (`${searchResult.record?.first_name ?? ""} ${searchResult.record?.last_name ?? ""}`.trim() || "—")}
            </div>
            <div className="text-xs text-muted-foreground">
              {searchResult.record?.email ?? searchResult.record?.phone ?? ""}
            </div>
          </div>
        )}
      </section>

      {/* Dispatch zones */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-lg font-extrabold tracking-tight mb-3">Dispatch Zones</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
          {zones.map((z: any) => {
            const count = zipsByZone.get(z.id)?.length ?? 0;
            const active = activeZoneId === z.id;
            return (
              <button
                key={z.id}
                onClick={() => setActiveZoneId(z.id)}
                className={`border rounded-sm p-3 text-left ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
              >
                <div className="text-sm font-bold">{z.name}</div>
                <div className="text-xs text-muted-foreground">{count} ZIP{count === 1 ? "" : "s"}</div>
              </button>
            );
          })}
        </div>

        {caps.canManageZones && <BulkZipImporter zones={zones} onDone={() => qc.invalidateQueries()} />}


        {activeZoneId && (
          <div className="space-y-3">
            {caps.canManageZones ? (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Add ZIPs to {zones.find((z: any) => z.id === activeZoneId)?.name}
                </label>
                <div className="flex gap-2">
                  <input
                    placeholder="32801, 32803 34103…"
                    value={zipInput}
                    onChange={(e) => setZipInput(e.target.value)}
                    className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono"
                  />
                  <button onClick={handleAssign} disabled={mAssign.isPending} className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-sm">
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                🔒 {permissionMessage("canManageZones")}
              </div>
            )}
            <div className="flex flex-wrap gap-1">
              {(zipsByZone.get(activeZoneId) ?? []).map((zip) => (
                <span key={zip} className="text-xs font-mono bg-background border border-border rounded-sm px-2 py-1 flex items-center gap-1">
                  {zip}
                  {caps.canManageZones && (
                    <button onClick={() => mRemove.mutate(zip)} className="text-red-600 font-bold hover:text-red-700">×</button>
                  )}
                </span>
              ))}
              {(zipsByZone.get(activeZoneId) ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">No ZIPs assigned yet.</span>
              )}
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Dispatcher — trips in zone
              </h3>
              {activeZoneId && <ZoneDispatcher
                zoneId={activeZoneId}
                trips={tripsQ.data ?? []}
                loading={tripsQ.isLoading}
                providersFn={providersFn}
                onAssign={(trip_id, assigned_to) => mReassign.mutate({ trip_id, assigned_to })}
                onCancel={(trip_id) => { if (confirm("Cancel this trip?")) mCancelTrip.mutate(trip_id); }}
              />}
            </div>
          </div>
        )}
      </section>

      {/* Provider weekly schedules */}
      <section className="bg-card border border-border rounded-2xl p-5">
        <h2 className="text-lg font-extrabold tracking-tight mb-3">Provider Weekly Schedules</h2>
        {schedQ.isLoading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : (schedQ.data ?? []).length === 0 ? (
          <div className="text-sm text-muted-foreground">No schedule entries submitted yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Time</th>
                  <th className="py-2 pr-3">Passenger</th>
                  <th className="py-2 pr-3">Pickup</th>
                  <th className="py-2 pr-3">Drop-off</th>
                  <th className="py-2 pr-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {(schedQ.data ?? []).map((r: any) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="py-2 pr-3">{r.pickup_date}</td>
                    <td className="py-2 pr-3">{String(r.pickup_time).slice(0, 5)}{r.dropoff_time ? ` → ${String(r.dropoff_time).slice(0, 5)}` : ""}</td>
                    <td className="py-2 pr-3">{r.passenger_first_name} {r.passenger_last_name}{r.passenger_phone ? ` · ${r.passenger_phone}` : ""}</td>
                    <td className="py-2 pr-3 text-xs">{r.pickup_address}</td>
                    <td className="py-2 pr-3 text-xs">{r.dropoff_address}</td>
                    <td className="py-2 pr-3 text-xs font-bold">{r.round_trip ? "Round trip" : "One-way"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ZoneDispatcher({
  zoneId, trips, loading, providersFn, onAssign, onCancel,
}: {
  zoneId: string;
  trips: any[];
  loading: boolean;
  providersFn: (arg: { data: { zone_id: string } }) => Promise<any>;
  onAssign: (trip_id: string, assigned_to: string | null) => void;
  onCancel: (trip_id: string) => void;
}) {
  const providersQ = useQuery({
    queryKey: ["disp", "providers", zoneId],
    queryFn: () => providersFn({ data: { zone_id: zoneId } }),
  });
  const providers: any[] = providersQ.data ?? [];

  if (loading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (trips.length === 0) return <div className="text-sm text-muted-foreground">No trips routed to this zone yet.</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
          <tr>
            <th className="py-2 pr-3">Trip ID</th>
            <th className="py-2 pr-3">Patient</th>
            <th className="py-2 pr-3">Pickup</th>
            <th className="py-2 pr-3">Original</th>
            <th className="py-2 pr-3">Source</th>
            <th className="py-2 pr-3">Status</th>
            <th className="py-2 pr-3">Payment</th>
            <th className="py-2 pr-3 text-right">Referral</th>
            <th className="py-2 pr-3 text-right">Platform</th>
            <th className="py-2 pr-3 text-right">Provider net</th>
            <th className="py-2 pr-3">Assign to provider</th>
            <th className="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => (
            <TripRow
              key={t.id}
              trip={t}
              providers={providers}
              onAssign={onAssign}
              onCancel={onCancel}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TripRow({
  trip: t, providers, onAssign, onCancel,
}: {
  trip: any;
  providers: any[];
  onAssign: (trip_id: string, assigned_to: string | null) => void;
  onCancel: (trip_id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const suggestFn = useServerFn(suggestProvidersForTrip);
  const offerFn = useServerFn(offerTripPriority);
  const sugQ = useQuery({
    queryKey: ["disp", "suggest", t.id],
    enabled: open,
    queryFn: () => suggestFn({ data: { trip_id: t.id } }),
  });
  const mOffer = useMutation({
    mutationFn: (provider_user_id: string) => offerFn({ data: { trip_id: t.id, provider_user_id } }),
    onSuccess: () => {
      toast.success("2-hour priority offer sent");
      qc.invalidateQueries({ queryKey: ["disp"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send offer"),
  });

  return (
    <>
      <tr className="border-b border-border">
        <td className="py-2 pr-3 font-mono font-bold">{t.display_id}</td>
        <td className="py-2 pr-3">{t.patient_first_name} {t.patient_last_name}</td>
        <td className="py-2 pr-3 text-xs">{t.pickup_date} · {t.pickup_city} {t.pickup_zip ?? ""}</td>
        <td className="py-2 pr-3 text-xs">{t.original_provider_name ?? "—"}</td>
        <td className="py-2 pr-3 text-xs capitalize">{t.source ?? "—"}</td>
        <td className="py-2 pr-3 text-xs">{t.status}</td>
        <td className="py-2 pr-3 text-xs">{t.payment_status ?? "—"}</td>
        <td className="py-2 pr-3 text-xs text-right font-mono">{fmtCents(t.referral_fee_cents)}</td>
        <td className="py-2 pr-3 text-xs text-right font-mono">{fmtCents(t.platform_fee_cents)}</td>
        <td className="py-2 pr-3 text-xs text-right font-mono font-bold">{fmtCents(t.provider_payout_cents)}</td>
        <td className="py-2 pr-3">
          <select
            defaultValue={t.assigned_to ?? ""}
            onChange={(e) => onAssign(t.id, e.target.value || null)}
            className="bg-background border border-border rounded-sm px-2 py-1 text-xs"
          >
            <option value="">— Unassigned —</option>
            {providers.map((p) => (
              <option key={p.user_id} value={p.user_id}>
                {p.company_name || `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || p.display_id}
              </option>
            ))}
          </select>
        </td>
        <td className="py-2 pr-3 text-right whitespace-nowrap">
          <button onClick={() => setOpen((v) => !v)} className="text-xs font-bold text-primary hover:underline mr-3">
            {open ? "Hide" : "Suggest"}
          </button>
          {t.status !== "canceled" && (
            <button onClick={() => onCancel(t.id)} className="text-xs font-bold text-red-600 hover:underline">
              Cancel
            </button>
          )}
        </td>
      </tr>
      {open && (
        <tr className="bg-background/40">
          <td colSpan={13} className="p-3">
            <div className="text-xs uppercase font-bold text-muted-foreground mb-2">
              Fair Assignment Engine — ranked providers
            </div>
            {sugQ.isLoading ? (
              <div className="text-xs text-muted-foreground">Scoring providers…</div>
            ) : (sugQ.data ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground">No eligible providers found.</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="pr-2">Provider</th>
                    <th className="pr-2">Score</th>
                    <th className="pr-2">Rating</th>
                    <th className="pr-2">Price</th>
                    <th className="pr-2">Area</th>
                    <th className="pr-2">Vehicle</th>
                    <th className="pr-2">Fairness</th>
                    <th className="pr-2">Fleet</th>
                    <th className="pr-2">Reason</th>
                    <th className="pr-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {(sugQ.data as any[]).map((p) => (
                    <tr key={p.provider_user_id} className="border-t border-border">
                      <td className="pr-2 py-1">
                        <div className="font-bold">{p.company_name ?? p.display_id}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">{p.display_id}</div>
                      </td>
                      <td className="pr-2 font-bold">{p.score}</td>
                      <td className="pr-2">{p.rating_score}</td>
                      <td className="pr-2">{p.price_score}</td>
                      <td className="pr-2">{p.area_score}</td>
                      <td className="pr-2">{p.vehicle_score}</td>
                      <td className="pr-2">{p.fairness_score}</td>
                      <td className="pr-2">{p.fleet_score}</td>
                      <td className="pr-2 text-muted-foreground">
                        {p.affinity_active && <span className="mr-1 rounded bg-amber-100 px-1 font-bold text-amber-800">Priority</span>}
                        {p.reason}
                      </td>
                      <td className="pr-2 text-right whitespace-nowrap">
                        {p.affinity_active && (
                          <button
                            onClick={() => mOffer.mutate(p.provider_user_id)}
                            disabled={mOffer.isPending}
                            className="text-primary font-bold hover:underline mr-2"
                          >
                            Offer 2hr
                          </button>
                        )}
                        <button
                          onClick={() => onAssign(t.id, p.provider_user_id)}
                          className="font-bold hover:underline"
                        >
                          Assign
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function BulkZipImporter({ zones, onDone }: { zones: any[]; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [zoneId, setZoneId] = useState<string>("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newZoneCode, setNewZoneCode] = useState("");
  const [preview, setPreview] = useState<{ parsed: string[]; newZips: string[]; conflicts: { zip: string; zoneName: string }[] } | null>(null);
  const [override, setOverride] = useState(false);

  const previewMut = useMutation({
    mutationFn: async () => {
      const { previewImportZips } = await import("@/lib/zones.functions");
      return previewImportZips({ data: { raw } });
    },
    onSuccess: (r) => setPreview(r),
    onError: (e: any) => toast.error(e.message ?? "Preview failed"),
  });
  const importMut = useMutation({
    mutationFn: async () => {
      const { importZipsToZone } = await import("@/lib/zones.functions");
      return importZipsToZone({
        data: {
          raw,
          zoneId: zoneId || undefined,
          newZone: zoneId ? undefined : { code: newZoneCode.trim(), name: newZoneName.trim() },
          overrideConflicts: override,
        },
      });
    },
    onSuccess: (r) => {
      toast.success(`Imported ${r.inserted} ZIPs (${r.skipped} skipped).`);
      setOpen(false); setRaw(""); setPreview(null); setZoneId(""); setNewZoneName(""); setNewZoneCode(""); setOverride(false);
      onDone();
    },
    onError: (e: any) => toast.error(e.message ?? "Import failed"),
  });

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-4 text-sm font-bold border border-border rounded-sm px-3 py-2 hover:border-primary">
        + Bulk import ZIPs
      </button>
    );
  }
  return (
    <div className="mt-4 border border-primary/40 rounded-md p-4 bg-primary/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Bulk import ZIPs into a dispatch zone</h3>
        <button onClick={() => setOpen(false)} className="text-xs text-muted-foreground">Close</button>
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Existing zone</label>
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} className="w-full bg-background border border-border rounded-sm px-2 py-2 text-sm">
            <option value="">— Create new zone —</option>
            {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        {!zoneId && (
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="New zone name" value={newZoneName} onChange={(e) => setNewZoneName(e.target.value)} className="bg-background border border-border rounded-sm px-2 py-2 text-sm" />
            <input placeholder="code (fl-xyz)" value={newZoneCode} onChange={(e) => setNewZoneCode(e.target.value)} className="bg-background border border-border rounded-sm px-2 py-2 text-sm" />
          </div>
        )}
      </div>
      <textarea
        rows={5}
        placeholder="Paste ZIPs (comma, space, or newline separated). FL ZIPs only (32000–34999)."
        value={raw}
        onChange={(e) => { setRaw(e.target.value); setPreview(null); }}
        className="w-full bg-background border border-border rounded-sm px-2 py-2 text-sm font-mono"
      />
      <div className="flex gap-2">
        <button onClick={() => previewMut.mutate()} disabled={!raw.trim() || previewMut.isPending} className="text-sm border border-border rounded-sm px-3 py-2">
          {previewMut.isPending ? "Parsing…" : "Preview"}
        </button>
        <button
          onClick={() => importMut.mutate()}
          disabled={!preview || importMut.isPending || (!zoneId && (!newZoneName.trim() || !newZoneCode.trim()))}
          className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-sm"
        >
          {importMut.isPending ? "Importing…" : `Import ${preview?.newZips.length ?? 0} ZIPs`}
        </button>
      </div>
      {preview && (
        <div className="text-xs space-y-1">
          <p>Parsed: <b>{preview.parsed.length}</b> · New: <b className="text-primary">{preview.newZips.length}</b> · Conflicts: <b className={preview.conflicts.length ? "text-amber-600" : ""}>{preview.conflicts.length}</b></p>
          {preview.conflicts.length > 0 && (
            <>
              <details><summary className="cursor-pointer">Show conflicts ({preview.conflicts.length})</summary>
                <div className="max-h-40 overflow-y-auto font-mono">
                  {preview.conflicts.map((c) => <div key={c.zip}>{c.zip} → already in {c.zoneName}</div>)}
                </div>
              </details>
              <label className="flex items-center gap-2 text-xs mt-1">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                Move conflicting ZIPs to this zone (reassigns them)
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function fmtCents(v: number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v) / 100;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}


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
} from "@/lib/dispatch.functions";
import { listAllSchedules } from "@/lib/schedules.functions";
import {
  globalSearchById,
  adminAssignTrip,
  adminCancelTrip,
  listProvidersForZone,
} from "@/lib/system-ids.functions";

export function AdminDispatchPanel() {
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

  const zonesQ = useQuery({ queryKey: ["disp", "zones"], queryFn: () => zonesFn() });
  const zipsQ = useQuery({ queryKey: ["disp", "zips"], queryFn: () => zipsFn() });

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
              {searchResult.record?.company_name ?? `${searchResult.record?.first_name ?? ""} ${searchResult.record?.last_name ?? ""}`.trim() || "—"}
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

        {activeZoneId && (
          <div className="space-y-3">
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
            <div className="flex flex-wrap gap-1">
              {(zipsByZone.get(activeZoneId) ?? []).map((zip) => (
                <span key={zip} className="text-xs font-mono bg-background border border-border rounded-sm px-2 py-1 flex items-center gap-1">
                  {zip}
                  <button onClick={() => mRemove.mutate(zip)} className="text-red-600 font-bold hover:text-red-700">×</button>
                </span>
              ))}
              {(zipsByZone.get(activeZoneId) ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">No ZIPs assigned yet.</span>
              )}
            </div>

            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Recent trips in zone
              </h3>
              {tripsQ.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (tripsQ.data ?? []).length === 0 ? (
                <div className="text-sm text-muted-foreground">No trips routed to this zone yet.</div>
              ) : (
                <ul className="text-sm divide-y divide-border">
                  {(tripsQ.data ?? []).slice(0, 20).map((t: any) => (
                    <li key={t.id} className="py-2 flex justify-between">
                      <span><span className="font-mono font-bold">{t.display_id}</span> · {t.patient_first_name} {t.patient_last_name}</span>
                      <span className="text-xs text-muted-foreground">{t.pickup_date} · {t.pickup_city} {t.pickup_zip ?? ""}</span>
                    </li>
                  ))}
                </ul>
              )}
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

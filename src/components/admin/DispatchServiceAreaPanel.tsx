import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  listZoneZips,
  listDispatchCounties,
  listDispatchCountyStats,
  listDispatchZoneStats,
  assignZipsToCounty,
  moveCountyToZone,
  removeZipFromZone,
} from "@/lib/dispatch.functions";

type Zone = { id: string; code: string; name: string; sort_order?: number | null };

/**
 * Service-area manager organized as Dispatch Zone → County → ZIP codes.
 * Zone Managers and Admins pick a zone, then drill into a county instead of
 * scrolling a flat list of thousands of ZIPs.
 */
export function DispatchServiceAreaPanel({
  zones,
  activeZoneId,
  onSelectZone,
  canEdit,
}: {
  zones: Zone[];
  activeZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const zipsFn = useServerFn(listZoneZips);
  const countiesFn = useServerFn(listDispatchCounties);
  const countyStatsFn = useServerFn(listDispatchCountyStats);
  const zoneStatsFn = useServerFn(listDispatchZoneStats);
  const moveFn = useServerFn(moveCountyToZone);

  const zipsQ = useQuery({ queryKey: ["disp", "zips"], queryFn: () => zipsFn() });
  const countiesQ = useQuery({ queryKey: ["disp", "counties"], queryFn: () => countiesFn() });
  const countyStatsQ = useQuery({ queryKey: ["disp", "county-stats"], queryFn: () => countyStatsFn() });
  const zoneStatsQ = useQuery({ queryKey: ["disp", "stats"], queryFn: () => zoneStatsFn() });

  const [search, setSearch] = useState("");
  const [openCountyId, setOpenCountyId] = useState<string | null>(null);

  const counties = countiesQ.data ?? [];
  const zips = zipsQ.data ?? [];

  const zipsByCounty = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const z of zips) {
      const key = z.county_id ?? "__none__";
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(z.zip);
    }
    for (const list of m.values()) list.sort();
    return m;
  }, [zips]);

  const zoneStats = zoneStatsQ.data ?? [];
  const countyStats = countyStatsQ.data ?? [];
  const statById = useMemo(
    () => new Map(countyStats.map((s) => [s.county_id, s])),
    [countyStats],
  );

  const term = search.trim().toLowerCase();
  const isZipSearch = /^\d{2,5}$/.test(term);

  // When searching a ZIP, jump to whichever zone/county owns it.
  const matchedZipCounties = useMemo(() => {
    if (!isZipSearch) return null;
    const s = new Set<string>();
    for (const z of zips) if (z.zip.startsWith(term) && z.county_id) s.add(z.county_id);
    return s;
  }, [isZipSearch, term, zips]);

  const visibleCounties = useMemo(() => {
    let list = counties;
    if (term) {
      list = list.filter((c) =>
        matchedZipCounties
          ? matchedZipCounties.has(c.id)
          : c.name.toLowerCase().includes(term),
      );
    } else if (activeZoneId) {
      list = list.filter((c) => c.region_id === activeZoneId);
    }
    return list;
  }, [counties, term, matchedZipCounties, activeZoneId]);

  const countiesByZone = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of counties) {
      if (!c.region_id) continue;
      m.set(c.region_id, (m.get(c.region_id) ?? 0) + 1);
    }
    return m;
  }, [counties]);

  const mMove = useMutation({
    mutationFn: (v: { county_id: string; zone_id: string }) => moveFn({ data: v }),
    onSuccess: (r: any) => {
      toast.success(`County moved · ${r?.moved ?? 0} ZIPs re-routed`);
      qc.invalidateQueries({ queryKey: ["disp"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not move county"),
  });

  const activeZone = zones.find((z) => z.id === activeZoneId) ?? null;
  const unassigned = zipsByCounty.get("__none__") ?? [];

  return (
    <section className="bg-card border border-border rounded-2xl p-5 space-y-5">
      <header>
        <h2 className="text-lg font-extrabold tracking-tight">Service Areas</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Florida is organized as <strong>Dispatch Zone → County → ZIP codes</strong>. Pick a zone
          to see its counties, then open a county to add or remove individual ZIP codes. County
          assignments are set by the system — they can only be changed in Admin settings below.
        </p>
      </header>


      {/* Tier 1 — dispatch zones */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
        {zones.map((z) => {
          const s = zoneStats.find((x) => x.zone_id === z.id);
          const active = activeZoneId === z.id && !term;
          return (
            <button
              key={z.id}
              onClick={() => {
                setSearch("");
                setOpenCountyId(null);
                onSelectZone(z.id);
              }}
              className={`border rounded-lg p-3 text-left transition-colors ${
                active ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="text-sm font-bold">{z.name}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Manager:{" "}
                <span className="text-foreground font-semibold">
                  {s?.managers?.[0]?.name || "Unassigned"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                <span>
                  Counties: <strong className="text-foreground">{countiesByZone.get(z.id) ?? 0}</strong>
                </span>
                <span>
                  ZIPs: <strong className="text-foreground">{s?.zip_count ?? 0}</strong>
                </span>
                <span>
                  Trips: <strong className="text-foreground">{s?.active_trips ?? 0}</strong>
                </span>
                <span>
                  Providers: <strong className="text-foreground">{s?.providers ?? 0}</strong>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search across every county / ZIP */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setOpenCountyId(null);
          }}
          placeholder="Search a county (Duval) or a ZIP (32204)…"
          className="flex-1 bg-background border border-border rounded-sm px-3 py-2 text-sm"
        />
        {term && (
          <button
            onClick={() => setSearch("")}
            className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-2"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-muted-foreground">
          {term
            ? `${visibleCounties.length} matching ${visibleCounties.length === 1 ? "county" : "counties"}`
            : activeZone
              ? `${visibleCounties.length} counties in ${activeZone.name}`
              : "Select a zone above"}
        </span>
      </div>

      {/* Tier 2 — counties */}
      {countiesQ.isLoading ? (
        <div className="text-sm text-muted-foreground">Loading counties…</div>
      ) : visibleCounties.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          {term ? "No county or ZIP matched that search." : "No counties mapped to this zone yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {visibleCounties.map((c) => {
            const s = statById.get(c.id);
            const countyZips = zipsByCounty.get(c.id) ?? [];
            const open = openCountyId === c.id;
            return (
              <div key={c.id} className="border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setOpenCountyId(open ? null : c.id)}
                  className={`w-full text-left px-3 py-2.5 flex items-center justify-between gap-3 ${
                    open ? "bg-primary/5" : "hover:bg-muted/40"
                  }`}
                  aria-expanded={open}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">
                      {c.name.replace(/, FL$/, "")}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {zones.find((z) => z.id === c.region_id)?.name ?? "Unassigned zone"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] shrink-0">
                    <span>
                      ZIPs <strong className="text-foreground">{countyZips.length}</strong>
                    </span>
                    <span>
                      Trips <strong className="text-foreground">{s?.active_trips ?? 0}</strong>
                    </span>
                    <span>
                      Providers <strong className="text-foreground">{s?.providers ?? 0}</strong>
                    </span>
                    <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
                  </div>
                </button>

                {open && (
                  <div className="border-t border-border p-3 space-y-3 bg-background/40">
                    {canEdit && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground self-center">
                          Dispatch zone
                        </label>
                        <select
                          value={c.region_id ?? ""}
                          disabled={mMove.isPending}
                          onChange={(e) =>
                            mMove.mutate({ county_id: c.id, zone_id: e.target.value })
                          }
                          className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm"
                          aria-label={`Dispatch zone for ${c.name}`}
                        >
                          <option value="" disabled>
                            Unassigned
                          </option>
                          {zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name}
                            </option>
                          ))}
                        </select>
                        <AddZipsToCounty countyId={c.id} />
                      </div>
                    )}

                    <ZipChips
                      zips={countyZips}
                      highlight={isZipSearch ? term : ""}
                      canEdit={canEdit}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {unassigned.length > 0 && (
        <div className="text-xs text-muted-foreground border-t border-border pt-3">
          {unassigned.length} ZIP{unassigned.length === 1 ? "" : "s"} are not linked to a county yet
          — they still route by zone. Open a county and add them to file them correctly.
        </div>
      )}
    </section>
  );
}

/** Collapsible ZIP list — shows a preview and expands on demand. */
function ZipChips({
  zips,
  highlight,
  canEdit,
}: {
  zips: string[];
  highlight: string;
  canEdit: boolean;
}) {
  const qc = useQueryClient();
  const removeFn = useServerFn(removeZipFromZone);
  const [showAll, setShowAll] = useState(false);
  const mRemove = useMutation({
    mutationFn: (zip: string) => removeFn({ data: { zip } }),
    onSuccess: () => {
      toast.success("ZIP removed");
      qc.invalidateQueries({ queryKey: ["disp"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove ZIP"),
  });

  if (zips.length === 0) {
    return <div className="text-xs text-muted-foreground">No ZIP codes in this county yet.</div>;
  }

  const shown = showAll ? zips : zips.slice(0, 40);

  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {shown.map((zip) => (
          <span
            key={zip}
            className={`text-xs font-mono border rounded-sm px-2 py-1 flex items-center gap-1 ${
              highlight && zip.startsWith(highlight)
                ? "border-primary bg-primary/10 font-bold"
                : "border-border bg-background"
            }`}
          >
            {zip}
            {canEdit && (
              <button
                onClick={() => mRemove.mutate(zip)}
                className="text-destructive font-bold hover:opacity-80"
                aria-label={`Remove ZIP ${zip}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {zips.length > 40 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs font-bold uppercase tracking-wider text-primary"
        >
          {showAll ? "Show fewer" : `Show all ${zips.length} ZIPs`}
        </button>
      )}
    </div>
  );
}

function AddZipsToCounty({ countyId }: { countyId: string }) {
  const qc = useQueryClient();
  const addFn = useServerFn(assignZipsToCounty);
  const [value, setValue] = useState("");
  const mAdd = useMutation({
    mutationFn: (zips: string[]) => addFn({ data: { county_id: countyId, zips } }),
    onSuccess: (r: any) => {
      toast.success(`Added ${r?.count ?? 0} ZIP${r?.count === 1 ? "" : "s"}`);
      setValue("");
      qc.invalidateQueries({ queryKey: ["disp"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not add ZIPs"),
  });

  return (
    <div className="flex gap-2 flex-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add ZIPs: 32204, 32207"
        className="flex-1 bg-background border border-border rounded-sm px-2 py-1.5 text-sm font-mono"
      />
      <button
        onClick={() => {
          const zips = Array.from(
            new Set(
              value
                .split(/[\s,;]+/)
                .map((s) => s.trim())
                .filter((s) => /^\d{5}$/.test(s)),
            ),
          );
          if (!zips.length) return toast.error("Enter one or more 5-digit ZIPs");
          mAdd.mutate(zips);
        }}
        disabled={mAdd.isPending}
        className="bg-primary text-primary-foreground text-sm font-bold px-3 py-1.5 rounded-sm disabled:opacity-60"
      >
        Add
      </button>
    </div>
  );
}

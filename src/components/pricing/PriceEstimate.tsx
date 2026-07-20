import { useQuery } from "@tanstack/react-query";
import { estimateTripPrice } from "@/lib/zone-pricing.functions";

/**
 * Estimated Trip Total across every leg of the reservation.
 * Computes total miles = one-way miles × leg count, and passes the
 * pickup count so each leg is billed a base pickup fee.
 */
export function PriceEstimate({
  pickupZip,
  miles,
  transportType = "ambulatory",
  providerId,
  compact,
  legs = 1,
  waitMinutes = 0,
  tripTypeLabel,
}: {
  pickupZip: string;
  /** Miles for a single one-way leg. The engine multiplies by `legs`. */
  miles: number;
  transportType?: "ambulatory" | "wheelchair" | "gurney";
  providerId?: string;
  compact?: boolean;
  legs?: number;
  waitMinutes?: number;
  tripTypeLabel?: string;
}) {
  const zip = (pickupZip || "").replace(/\D/g, "").slice(0, 5);
  const legCount = Math.max(1, Math.floor(legs || 1));
  const totalMiles = +(Math.max(0, miles) * legCount).toFixed(2);
  const enabled = zip.length === 5 && totalMiles > 0;

  const q = useQuery({
    queryKey: ["price-estimate", zip, totalMiles, transportType, providerId ?? "", legCount, waitMinutes],
    queryFn: () => estimateTripPrice({
      data: {
        pickupZip: zip,
        miles: totalMiles,
        transportType,
        providerId: providerId ?? "",
        legs: legCount,
        waitMinutes,
      },
    }),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-sm px-3 py-2">
        Enter a Florida pickup ZIP and drop-off to see an Estimated Trip Total.
      </div>
    );
  }

  if (q.isLoading) return <div className="text-xs text-muted-foreground">Calculating Estimated Trip Total…</div>;
  if (!q.data) return null;

  const lines = q.data.provider?.lines ?? q.data.zoneAverage.lines;
  const total = q.data.provider?.dollars ?? q.data.zoneAverage.dollars;
  const usingDefault = q.data.zoneAverage.usingDefault && !q.data.provider;

  return (
    <div className={`bg-secondary/40 border border-border rounded-sm ${compact ? "p-3" : "p-4"} space-y-3`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Estimated Trip Total{tripTypeLabel ? ` · ${tripTypeLabel}` : ""}
          </div>
          <div className="font-display text-3xl font-extrabold tracking-tight text-primary">{fmt(total)}</div>
        </div>
        <div className="text-right text-[11px] text-muted-foreground leading-tight">
          <div><span className="font-bold text-foreground">{legCount}</span> {legCount === 1 ? "leg" : "legs"} · <span className="font-bold text-foreground">{legCount}</span> {legCount === 1 ? "pickup" : "pickups"}</div>
          <div><span className="font-bold text-foreground">{totalMiles.toFixed(1)} mi</span> total{miles > 0 && legCount > 1 ? ` (${miles.toFixed(1)} × ${legCount})` : ""}</div>
          {waitMinutes > 0 && <div><span className="font-bold text-foreground">{waitMinutes}</span> min wait</div>}
        </div>
      </div>

      {lines.length > 0 && (
        <ul className="text-xs divide-y divide-border/60 border-t border-border/60 pt-2">
          {lines.map((l, i) => (
            <li key={i} className="flex items-start justify-between py-1.5 gap-4">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="tabular-nums font-semibold">{fmt(l.amount)}</span>
            </li>
          ))}
          <li className="flex items-start justify-between py-2 gap-4 border-t-2 border-foreground mt-1">
            <span className="text-xs font-bold uppercase tracking-wider">Estimated Trip Total</span>
            <span className="tabular-nums font-extrabold text-primary">{fmt(total)}</span>
          </li>
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground leading-snug">
        {usingDefault
          ? "Reference estimate — using platform default rates until more providers publish pricing for this area."
          : q.data.zone
            ? `Live average from ${q.data.zone.providerCount} active provider${q.data.zone.providerCount === 1 ? "" : "s"} in this dispatch zone.`
            : "Reference estimate."} The final total may change if trip details are modified before completion.
      </p>
    </div>
  );
}

function fmt(dollars: number): string {
  return (Number.isFinite(dollars) ? dollars : 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  });
}

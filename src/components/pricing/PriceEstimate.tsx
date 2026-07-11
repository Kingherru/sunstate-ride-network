import { useQuery } from "@tanstack/react-query";
import { estimateTripPrice } from "@/lib/zone-pricing.functions";

/**
 * Simple "Average zone price / selected provider price" display.
 * Reference-only — payment happens later in the flow.
 */
export function PriceEstimate({
  pickupZip,
  miles,
  transportType = "ambulatory",
  providerId,
  compact,
}: {
  pickupZip: string;
  miles: number;
  transportType?: "ambulatory" | "wheelchair" | "gurney";
  providerId?: string;
  compact?: boolean;
}) {
  const zip = (pickupZip || "").replace(/\D/g, "").slice(0, 5);
  const enabled = zip.length === 5 && miles > 0;

  const q = useQuery({
    queryKey: ["price-estimate", zip, miles, transportType, providerId ?? ""],
    queryFn: () => estimateTripPrice({
      data: { pickupZip: zip, miles, transportType, providerId: providerId ?? "" },
    }),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-sm px-3 py-2">
        Enter a Florida pickup ZIP and drop-off to see an estimated price.
      </div>
    );
  }

  if (q.isLoading) {
    return <div className="text-xs text-muted-foreground">Estimating price…</div>;
  }
  if (!q.data) return null;

  const zoneUsd = fmt(q.data.zoneAverage.dollars);
  const provUsd = q.data.provider ? fmt(q.data.provider.dollars) : null;
  const usingDefault = q.data.zoneAverage.usingDefault;

  return (
    <div className={`bg-secondary/40 border border-border rounded-sm ${compact ? "p-3" : "p-4"} space-y-2`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            {q.data.zone?.name ? `${q.data.zone.name} · Average zone price` : "Average zone price"}
          </div>
          <div className="font-display text-2xl font-extrabold tracking-tight text-primary">
            {zoneUsd}
          </div>
        </div>
        {provUsd && (
          <div className="text-right">
            <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Selected provider
            </div>
            <div className="font-display text-2xl font-extrabold tracking-tight text-accent">
              {provUsd}
            </div>
          </div>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {usingDefault
          ? "Reference estimate — using platform default rates until more providers publish pricing for this area."
          : q.data.zone
            ? `Live average from ${q.data.zone.providerCount} active provider${q.data.zone.providerCount === 1 ? "" : "s"} in this dispatch zone.`
            : "Reference estimate."} Final fare is set by the assigned provider.
      </p>
    </div>
  );
}

function fmt(dollars: number): string {
  return dollars.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

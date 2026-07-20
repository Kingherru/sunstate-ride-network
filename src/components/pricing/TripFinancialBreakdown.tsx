import { useQuery } from "@tanstack/react-query";
import { estimateTripPrice } from "@/lib/zone-pricing.functions";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformFeePct } from "@/hooks/usePlatformFee";

/**
 * Full pre-submit financial breakdown for a provider-created trip. Shows:
 * client charge, referral fee (sender), platform fee (MFN), provider net,
 * and the final amount required for the trip to move forward.
 */
export function TripFinancialBreakdown({
  pickupZip,
  miles,
  transportType = "ambulatory",
  providerId,
  senderUserId,
  legs = 1,
  waitMinutes = 0,
  tripTypeLabel,
}: {
  pickupZip: string;
  /** One-way miles. The engine multiplies by leg count. */
  miles: number;
  transportType?: "ambulatory" | "wheelchair" | "gurney";
  providerId?: string;
  senderUserId?: string;
  legs?: number;
  waitMinutes?: number;
  tripTypeLabel?: string;
}) {
  const zip = (pickupZip || "").replace(/\D/g, "").slice(0, 5);
  const legCount = Math.max(1, Math.floor(legs || 1));
  const totalMiles = +(Math.max(0, miles) * legCount).toFixed(2);
  const enabled = zip.length === 5 && totalMiles > 0;
  const platformFeePct = usePlatformFeePct();

  const estQ = useQuery({
    queryKey: ["price-estimate", zip, totalMiles, transportType, providerId ?? "", legCount, waitMinutes],
    queryFn: () => estimateTripPrice({
      data: { pickupZip: zip, miles: totalMiles, transportType, providerId: providerId ?? "", legs: legCount, waitMinutes },
    }),
    enabled,
    staleTime: 60_000,
  });

  const feeQ = useQuery({
    queryKey: ["my-referral-fee", senderUserId ?? ""],
    enabled: !!senderUserId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_profiles")
        .select("referral_fee_type, referral_fee_amount")
        .eq("user_id", senderUserId!)
        .maybeSingle();
      if (error) return { referral_fee_type: null, referral_fee_amount: null };
      return data as { referral_fee_type: "flat" | "percent" | null; referral_fee_amount: number | null };
    },
  });

  if (!enabled) {
    return (
      <div className="text-xs text-muted-foreground border border-dashed border-border rounded-sm px-3 py-2">
        Enter a Florida pickup ZIP and drop-off to see the full financial breakdown.
      </div>
    );
  }
  if (estQ.isLoading) return <div className="text-xs text-muted-foreground">Calculating breakdown…</div>;
  if (!estQ.data) return null;

  const clientCharge = estQ.data.provider?.dollars ?? estQ.data.zoneAverage.dollars ?? 0;
  const fareLines = estQ.data.provider?.lines ?? estQ.data.zoneAverage.lines ?? [];

  const feeType = feeQ.data?.referral_fee_type ?? null;
  const feeVal = Number(feeQ.data?.referral_fee_amount ?? 0);
  const referralFee =
    feeType === "flat" ? Math.max(0, feeVal) :
    feeType === "percent" ? Math.max(0, (clientCharge * feeVal) / 100) : 0;

  const finalRequired = clientCharge + referralFee;
  const platformFee = finalRequired * platformFeePct;
  const providerNet = Math.max(0, finalRequired - platformFee - referralFee);

  return (
    <div className="bg-card border border-border rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-extrabold uppercase tracking-wide">Trip financial breakdown</h4>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Pre-submit estimate</span>
      </div>

      <div className="text-[11px] text-muted-foreground grid grid-cols-3 gap-2 border border-border/60 rounded-sm p-2">
        <div><span className="font-bold text-foreground">{legCount}</span> {legCount === 1 ? "leg" : "legs"}{tripTypeLabel ? ` · ${tripTypeLabel}` : ""}</div>
        <div><span className="font-bold text-foreground">{legCount}</span> {legCount === 1 ? "pickup" : "pickups"}</div>
        <div><span className="font-bold text-foreground">{totalMiles.toFixed(1)} mi</span>{miles > 0 && legCount > 1 ? ` (${miles.toFixed(1)} × ${legCount})` : ""}</div>
        {waitMinutes > 0 && <div className="col-span-3"><span className="font-bold text-foreground">{waitMinutes}</span> min projected wait time</div>}
      </div>

      {fareLines.length > 0 && (
        <ul className="text-xs divide-y divide-border/60 border border-border/60 rounded-sm px-2">
          {fareLines.map((l, i) => (
            <li key={i} className="flex items-start justify-between py-1.5 gap-4">
              <span className="text-muted-foreground">{l.label}</span>
              <span className="tabular-nums font-semibold">{fmt(l.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="text-sm divide-y divide-border/60">
        <Row label="Estimated Trip Total (client charge)" value={clientCharge} hint="Sum of every leg, pickup, mileage, wait time, and add-ons above." />
        <Row
          label="Provider referral fee"
          value={referralFee}
          hint={
            !feeType
              ? "No referral fee set. Configure a default in Account → Business Information."
              : feeType === "percent"
                ? `Your default: ${feeVal}% of the client trip charge.`
                : `Your default: flat $${feeVal.toFixed(2)} per referred trip.`
          }
          muted={!feeType}
        />
        <Row
          label="My Florida NEMT platform fee"
          value={platformFee}
          hint={`${(platformFeePct * 100).toFixed(2)}% of the total charge — covers dispatch, payouts, and compliance.`}
        />
        <Row
          label="Amount paid to completing provider"
          value={providerNet}
          hint="What the receiving provider receives after the referral fee and platform fee are removed."
          emphasize
        />
      </ul>

      <div className="flex items-center justify-between border-t-2 border-foreground pt-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Estimated Trip Total required before dispatch
          </div>
          <div className="text-[11px] text-muted-foreground">Client charge plus your referral fee. Final amount may change if trip details are modified before completion.</div>
        </div>
        <div className="font-display text-2xl font-extrabold tracking-tight text-primary">{fmt(finalRequired)}</div>
      </div>
    </div>
  );
}

function Row({
  label, value, hint, muted, emphasize,
}: { label: string; value: number; hint?: string; muted?: boolean; emphasize?: boolean }) {
  return (
    <li className="py-2 flex items-start justify-between gap-4">
      <div className={muted ? "text-muted-foreground" : ""}>
        <div className={`text-sm ${emphasize ? "font-extrabold" : "font-bold"}`}>{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>}
      </div>
      <div className={`text-sm tabular-nums ${emphasize ? "font-extrabold text-accent" : "font-bold"}`}>{fmt(value)}</div>
    </li>
  );
}

function fmt(dollars: number): string {
  return (Number.isFinite(dollars) ? dollars : 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  });
}

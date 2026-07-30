import { useQuery } from "@tanstack/react-query";
import { estimateTripPrice } from "@/lib/zone-pricing.functions";
import { computeReferralPayoutCents } from "@/lib/referral-fee.functions";
import { usePlatformFeePct } from "@/hooks/usePlatformFee";

/**
 * Pre-submit money transparency for a provider-created trip.
 *
 * Two outcomes are shown side by side so the provider knows exactly what
 * happens before they submit:
 *
 *  1. They confirm and complete the trip themselves — the invoice is created
 *     automatically at the selected price (their own pricing, or the My
 *     Florida NEMT recommended price).
 *  2. They send the trip to My Florida NEMT for fulfillment — no platform fee
 *     is charged to them, and the referral fee is a payout OWED TO THEM after
 *     the trip is completed, never a charge against them.
 */
export function TripFinancialBreakdown({
  pickupZip,
  miles,
  transportType = "ambulatory",
  providerId,
  senderUserId,
  legs = 1,
  stops,
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
  /** Extra stops the user actually entered (a return leg is not a stop). */
  stops?: number;
  waitMinutes?: number;
  tripTypeLabel?: string;
}) {
  void senderUserId;
  const zip = (pickupZip || "").replace(/\D/g, "").slice(0, 5);
  const legCount = Math.max(1, Math.floor(legs || 1));
  const stopCount = Math.max(0, Math.floor(stops ?? legCount - 1));
  const totalMiles = +(Math.max(0, miles) * legCount).toFixed(2);
  const enabled = zip.length === 5 && totalMiles > 0;
  const platformFeePct = usePlatformFeePct();

  const estQ = useQuery({
    queryKey: ["price-estimate", zip, totalMiles, transportType, providerId ?? "", legCount, stopCount, waitMinutes],
    queryFn: () => estimateTripPrice({
      data: { pickupZip: zip, miles: totalMiles, transportType, providerId: providerId ?? "", legs: legCount, stops: stopCount, waitMinutes },
    }),
    enabled,
    staleTime: 60_000,
  });

  const clientCharge = estQ.data?.active?.dollars ?? 0;

  // Referral payout is system-calculated from the admin-controlled rate.
  // The percentage itself is never exposed to providers — only the amount.
  const referralQ = useQuery({
    queryKey: ["referral-payout-cents", Math.round(clientCharge * 100)],
    enabled: clientCharge > 0,
    staleTime: 60_000,
    queryFn: () => computeReferralPayoutCents({ data: { amountCents: Math.round(clientCharge * 100) } }),
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

  const source = estQ.data.active.source;
  const fareLines = estQ.data.active.lines ?? [];
  const priceLabel =
    source === "custom"
      ? "your own provider pricing"
      : "My Florida NEMT recommended pricing";

  const referralPayout = Math.max(0, (referralQ.data?.cents ?? 0) / 100);
  const platformFee = clientCharge * platformFeePct;
  const youKeep = Math.max(0, clientCharge - platformFee);

  return (
    <div className="bg-card border border-border rounded-sm p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h4 className="text-sm font-extrabold uppercase tracking-wide">Pricing, invoicing &amp; payouts</h4>
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
          <li className="flex items-start justify-between py-2 gap-4 border-t-2 border-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Selected price for this trip</span>
            <span className="tabular-nums font-extrabold text-primary">{fmt(clientCharge)}</span>
          </li>
        </ul>
      )}

      {/* Automatic invoicing notice — the price the provider selected is the price invoiced */}
      <div className="border-l-4 border-primary bg-secondary/40 rounded-sm p-3">
        <p className="text-xs font-bold mb-1">
          You&apos;re using {priceLabel} — {fmt(clientCharge)}.
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          If you confirm this reservation and complete the trip yourself, the invoice is created
          automatically at this selected price. Nothing else to enter — the amount above is what the
          client or payer is billed once the trip is completed.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Outcome 1 — provider completes it */}
        <div className="border border-border rounded-sm p-3 space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider">If you complete this trip</div>
          <ul className="text-sm divide-y divide-border/60">
            <Row label="Invoice created automatically" value={clientCharge} hint="Billed to the client or payer at the selected price when the trip is completed." />
            <Row
              label="My Florida NEMT platform fee"
              value={platformFee}
              hint={`${(platformFeePct * 100).toFixed(2)}% of the invoiced amount — covers dispatch, payouts and compliance.`}
            />
            <Row label="You receive" value={youKeep} hint="Paid out after the trip is completed, following the standard payout hold." emphasize />
          </ul>
        </div>

        {/* Outcome 2 — sent to My Florida NEMT */}
        <div className="border border-border rounded-sm p-3 space-y-2">
          <div className="text-xs font-extrabold uppercase tracking-wider">If you send it to My Florida NEMT</div>
          <ul className="text-sm divide-y divide-border/60">
            <Row label="Platform fee charged to you" value={0} hint="No platform fee applies when My Florida NEMT fulfills the trip for you." />
            <Row
              label="Referral payout owed to you"
              value={referralPayout}
              hint="Not a charge — this is money paid to you after the trip is completed, under the standard referral rules."
              muted={referralPayout <= 0}
              emphasize={referralPayout > 0}
            />
          </ul>
          <p className="text-[11px] text-muted-foreground leading-snug">
            My Florida NEMT assigns and invoices the trip. You are never billed for sending a trip —
            you only receive the referral payout once it is completed.
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground leading-snug border-t border-border pt-3">
        You choose how the trip is fulfilled after it&apos;s created — confirm it yourself, or send it
        to My Florida NEMT from your Reservations page. Final amounts may change if trip details are
        modified before completion.
      </p>
    </div>
  );
}

function Row({
  label, value, hint, muted, emphasize,
}: { label: string; value: number; hint?: string; muted?: boolean; emphasize?: boolean }) {
  return (
    <li className="py-2 flex items-start justify-between gap-4">
      <div className={`min-w-0 ${muted ? "text-muted-foreground" : ""}`}>
        <div className={`text-sm ${emphasize ? "font-extrabold" : "font-bold"}`}>{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>}
      </div>
      <div className={`text-sm tabular-nums shrink-0 ${emphasize ? "font-extrabold text-accent" : "font-bold"}`}>{fmt(value)}</div>
    </li>
  );
}

function fmt(dollars: number): string {
  return (Number.isFinite(dollars) ? dollars : 0).toLocaleString("en-US", {
    style: "currency", currency: "USD", maximumFractionDigits: 2,
  });
}

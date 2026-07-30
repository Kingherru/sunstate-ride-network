import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformFeePct } from "@/hooks/usePlatformFee";
import { updateTripStatus } from "@/lib/trips.functions";
import { respondToReferral } from "@/lib/referrals.functions";

import { toast } from "sonner";

/**
 * Modal shown to a receiving provider before they can accept or decline a
 * referred trip. Displays trip details plus a full financial breakdown, and
 * requires the recipient to explicitly agree to the payment terms before
 * accepting.
 */
export function ReferralReviewModal({
  trip,
  onClose,
  onDone,
}: {
  trip: any;
  onClose: () => void;
  onDone: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState<null | "accept" | "decline">(null);
  const platformFeePct = usePlatformFeePct();

  const senderQ = useQuery({
    queryKey: ["referral-sender", trip?.created_by ?? ""],
    enabled: !!trip?.created_by,
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("member_profiles")
        .select("first_name, last_name, company_name, referral_fee_type, referral_fee_amount")
        .eq("user_id", trip.created_by)
        .maybeSingle();
      return data as {
        first_name: string | null;
        last_name: string | null;
        company_name: string | null;
        referral_fee_type: "flat" | "percent" | null;
        referral_fee_amount: number | null;
      } | null;
    },
  });

  const clientCharge = Number(trip?.cost_total ?? 0);
  const feeType = senderQ.data?.referral_fee_type ?? null;
  const feeVal = Number(senderQ.data?.referral_fee_amount ?? 0);
  const referralFee =
    feeType === "flat" ? Math.max(0, feeVal) :
    feeType === "percent" ? Math.max(0, (clientCharge * feeVal) / 100) : 0;
  const platformFee = clientCharge * platformFeePct;
  const providerNet = Math.max(0, clientCharge - platformFee - referralFee);

  const referrer =
    senderQ.data?.company_name ||
    [senderQ.data?.first_name, senderQ.data?.last_name].filter(Boolean).join(" ") ||
    "Referring provider";

  async function respond(status: "accepted" | "declined") {
    if (status === "accepted" && !agreed) {
      toast.error("Please confirm the financial terms before accepting.");
      return;
    }
    setBusy(status === "accepted" ? "accept" : "decline");
    try {
      // Pending referrals go through the referral workflow (assigns the trip on
      // accept, re-routes to the next eligible provider on decline). Trips that
      // are already assigned just change status.
      if (String(trip?.referral_status ?? "").toLowerCase() === "pending") {
        const res: any = await respondToReferral({
          data: { trip_id: trip.id, accept: status === "accepted" },
        });
        toast.success(
          status === "accepted"
            ? "Referral accepted — trip moved to your Booked reservations"
            : res?.rerouted
              ? "Referral declined — sent to the next eligible provider"
              : "Referral declined — returned to dispatch",
        );
      } else {
        await updateTripStatus({ data: { trip_id: trip.id, status } });
        toast.success(status === "accepted" ? "Trip accepted" : "Trip declined");
      }
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? `Could not ${status === "accepted" ? "accept" : "decline"} trip`);
    } finally {
      setBusy(null);
    }
  }


  const pickupWhen = [trip?.pickup_date, trip?.pickup_time].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-3 overflow-y-auto">
      <div className="bg-card border border-border rounded-sm max-w-2xl w-full my-6 shadow-xl">
        <div className="p-5 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Review referred trip</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Referred by <strong>{referrer}</strong>. Review the trip details and financial
              terms before accepting or declining.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5">
          {/* Trip details */}
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Trip details</h3>
            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <Info label="Patient" value={`${trip.patient_first_name ?? ""} ${trip.patient_last_name ?? ""}`.trim() || "—"} />
              <Info label="Transport type" value={trip.transport_type ?? "—"} />
              <Info label="Service level" value={trip.service_level ?? "—"} />
              <Info label="Scheduled" value={pickupWhen || "—"} />
              <Info label="Round trip" value={trip.round_trip ? "Yes" : "No"} />
              <Info label="Trip #" value={trip.display_id ?? trip.trip_number ?? "—"} />
            </div>
          </section>

          {/* Pickup / dropoff */}
          <section className="grid sm:grid-cols-2 gap-3">
            <div className="border border-border rounded-sm p-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pickup</div>
              <div className="font-bold mt-1">{trip.pickup_address ?? "—"}</div>
              <div className="text-muted-foreground text-xs">
                {[trip.pickup_city, trip.pickup_zip].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
            <div className="border border-border rounded-sm p-3 text-sm">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Drop-off</div>
              <div className="font-bold mt-1">{trip.dropoff_address ?? "—"}</div>
              <div className="text-muted-foreground text-xs">
                {[trip.dropoff_city, trip.dropoff_zip].filter(Boolean).join(", ") || "—"}
              </div>
            </div>
          </section>

          {/* Financial breakdown */}
          <section className="border border-border rounded-sm p-4 space-y-3 bg-secondary/30">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold uppercase tracking-wide">Financial breakdown</h3>
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Before you accept</span>
            </div>
            <ul className="text-sm divide-y divide-border/60">
              <FinRow label="Client trip charge" value={clientCharge} hint="Total the client / payer is being charged for this trip." />
              <FinRow
                label={`Referral fee to ${referrer}`}
                value={referralFee}
                hint={
                  !feeType
                    ? "No referral fee set by the referring provider."
                    : feeType === "percent"
                      ? `Referring provider's default: ${feeVal}% of the client charge.`
                      : `Referring provider's default: flat $${feeVal.toFixed(2)}.`
                }
                muted={!feeType}
              />
              <FinRow
                label="My Florida NEMT platform fee"
                value={platformFee}
                hint={`${(platformFeePct * 100).toFixed(2)}% of the client charge — dispatch, payouts, and compliance.`}
              />
              <FinRow
                label="Amount you will receive"
                value={providerNet}
                hint="What you'll be paid after platform and referral fees are removed. Held per payout policy (48h standard, Net-15 Medicaid)."
                emphasize
              />
            </ul>
          </section>

          {/* Agree gate */}
          <label className="flex items-start gap-2 text-sm bg-muted/40 border border-border rounded-sm p-3">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <strong>I accept the financial terms above.</strong> I understand my payout is{" "}
              <strong>${providerNet.toFixed(2)}</strong> after the referral fee and platform fee,
              and that funds release per My Florida NEMT's standard payout policy.
            </span>
          </label>
        </div>

        <div className="p-5 border-t border-border flex flex-wrap items-center justify-end gap-2">
          <button
            onClick={() => respond("declined")}
            disabled={busy !== null}
            className="text-sm font-bold bg-red-600 text-white px-4 py-2 rounded-sm hover:bg-red-700 disabled:opacity-60"
          >
            {busy === "decline" ? "Declining…" : "Decline"}
          </button>
          <button
            onClick={() => respond("accepted")}
            disabled={!agreed || busy !== null}
            className="text-sm font-bold bg-emerald-600 text-white px-5 py-2 rounded-sm hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy === "accept" ? "Accepting…" : "Accept trip"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-bold capitalize">{value}</div>
    </div>
  );
}

function FinRow({
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

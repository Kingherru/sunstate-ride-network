import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_FEE_PCT, formatUsd, platformFeeCents, providerPayoutCents } from "@/lib/payouts";

type Trip = {
  id: string;
  status: string;
  pickup_date: string;
  cost_total: number | null;
  payout_status: "pending" | "held" | "released" | "canceled";
  payout_released_at: string | null;
  provider_payout_cents: number | null;
  platform_fee_cents: number | null;
};

type PayoutAccount = {
  status: "not_connected" | "pending" | "active" | "restricted";
  payouts_enabled: boolean;
  charges_enabled: boolean;
  stripe_account_id: string | null;
};

export function PayoutsPanel({ userId }: { userId: string }) {
  const acctQ = useQuery({
    queryKey: ["payout-account", userId],
    queryFn: async (): Promise<PayoutAccount | null> => {
      const { data } = await supabase
        .from("provider_payout_accounts")
        .select("status, payouts_enabled, charges_enabled, stripe_account_id")
        .eq("user_id", userId)
        .maybeSingle();
      return (data as PayoutAccount) ?? null;
    },
  });

  const tripsQ = useQuery({
    queryKey: ["payout-trips", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("id, status, pickup_date, cost_total, payout_status, payout_released_at, provider_payout_cents, platform_fee_cents")
        .eq("assigned_to", userId)
        .order("pickup_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Trip[];
    },
  });

  const trips = tripsQ.data ?? [];

  const held = trips
    .filter((t) => t.payout_status === "held" || t.payout_status === "pending")
    .reduce((sum, t) => sum + computePayout(t), 0);
  const released = trips
    .filter((t) => t.payout_status === "released")
    .reduce((sum, t) => sum + computePayout(t), 0);
  const releasedCount = trips.filter((t) => t.payout_status === "released").length;

  return (
    <div className="space-y-6">
      <ConnectCard account={acctQ.data ?? null} loading={acctQ.isLoading} />

      <div className="grid sm:grid-cols-3 gap-3">
        <Stat label="Held funds" value={formatUsd(held)} hint="Pending completion" />
        <Stat label="Released to you" value={formatUsd(released)} hint={`${releasedCount} trip${releasedCount === 1 ? "" : "s"}`} tone="success" />
        <Stat label="Platform fee" value={`${(PLATFORM_FEE_PCT * 100).toFixed(0)}%`} hint="Per processed payment" />
      </div>

      <BillingExplainer />

      <section className="bg-card border border-border rounded-sm p-5">
        <h3 className="text-lg font-extrabold tracking-tight mb-3">Trip releases</h3>
        {tripsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : trips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No assigned trips yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2">Trip</th>
                <th className="text-left">Date</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Fee</th>
                <th className="text-right">Your payout</th>
                <th className="text-left pl-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {trips.map((t) => (
                <tr key={t.id}>
                  <td className="py-2 font-mono text-xs">{t.id.slice(0, 8)}</td>
                  <td>{t.pickup_date}</td>
                  <td className="text-right">{formatUsd((t.cost_total ?? 0) * 100)}</td>
                  <td className="text-right text-muted-foreground">−{formatUsd(t.platform_fee_cents ?? platformFeeCents(Math.round((t.cost_total ?? 0) * 100)))}</td>
                  <td className="text-right font-bold">{formatUsd(computePayout(t))}</td>
                  <td className="pl-3"><PayoutBadge status={t.payout_status} releasedAt={t.payout_released_at} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function computePayout(t: Trip): number {
  if (t.provider_payout_cents != null) return t.provider_payout_cents;
  const gross = Math.round((t.cost_total ?? 0) * 100);
  return providerPayoutCents(gross);
}

function ConnectCard({ account, loading }: { account: PayoutAccount | null; loading: boolean }) {
  const status = account?.status ?? "not_connected";
  const map: Record<string, { label: string; tone: string; desc: string }> = {
    not_connected: {
      label: "Not connected",
      tone: "bg-orange-100 text-orange-800 border-orange-200",
      desc: "Connect a bank account to receive trip payouts. We'll guide you through identity verification (about 5 minutes).",
    },
    pending: {
      label: "Verification in progress",
      tone: "bg-yellow-100 text-yellow-800 border-yellow-200",
      desc: "We're waiting on verification documents. Released funds will hold here until your account is active.",
    },
    active: {
      label: "Active · payouts enabled",
      tone: "bg-emerald-100 text-emerald-800 border-emerald-200",
      desc: "You're set up to receive payouts. Funds release to your bank 1–2 business days after each completed trip.",
    },
    restricted: {
      label: "Action required",
      tone: "bg-red-100 text-red-800 border-red-200",
      desc: "Your account has open requirements. Resolve them to keep receiving payouts.",
    },
  };
  const m = map[status];

  return (
    <section className="bg-card border border-border rounded-sm p-5 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-1">Connected account</p>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-sm border ${m.tone}`}>{m.label}</span>
          {account?.stripe_account_id && (
            <span className="text-[10px] font-mono text-muted-foreground">{account.stripe_account_id}</span>
          )}
        </div>
        <p className="text-sm text-muted-foreground max-w-xl">{m.desc}</p>
      </div>
      <button
        disabled={loading}
        className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-sm hover:bg-primary/90 disabled:opacity-50"
        onClick={() => alert("Bank connection onboarding launches here once your admin enables provider payouts.")}
      >
        {status === "not_connected" ? "Connect bank account" : "Manage account"}
      </button>
    </section>
  );
}

function BillingExplainer() {
  return (
    <section className="bg-primary/5 border border-primary/20 rounded-sm p-5">
      <h3 className="text-lg font-extrabold tracking-tight mb-2">How billing works</h3>
      <ol className="text-sm text-foreground/90 space-y-2 list-decimal pl-5">
        <li><strong>Patient pays at booking.</strong> The fare is charged to the patient and held by FloridaNEMT.</li>
        <li><strong>You complete the trip.</strong> Mark the trip <em>Completed</em> in your dashboard so it queues for release.</li>
        <li><strong>We deduct a {(PLATFORM_FEE_PCT * 100).toFixed(0)}% platform fee.</strong> This covers payment processing, dispatch, and HIPAA-compliant infrastructure.</li>
        <li><strong>Funds release to your bank.</strong> The remainder transfers to your connected account within 1–2 business days.</li>
        <li><strong>Provider-to-provider payouts.</strong> If you dispatch a trip to another provider, your "pay" rate from <em>Pricing</em> is transferred to them on completion, minus the same {(PLATFORM_FEE_PCT * 100).toFixed(0)}% fee.</li>
      </ol>
      <p className="text-xs text-muted-foreground mt-3">
        Example: a $100 fare → ${(100 * PLATFORM_FEE_PCT).toFixed(2)} fee, ${(100 * (1 - PLATFORM_FEE_PCT)).toFixed(2)} to you.
      </p>
    </section>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" }) {
  return (
    <div className="bg-card border border-border rounded-sm p-4">
      <div className={`text-2xl font-extrabold tabular-nums ${tone === "success" ? "text-emerald-600" : "text-foreground"}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function PayoutBadge({ status, releasedAt }: { status: Trip["payout_status"]; releasedAt: string | null }) {
  const map: Record<string, string> = {
    pending: "bg-muted/40 text-muted-foreground",
    held: "bg-yellow-100 text-yellow-800",
    released: "bg-emerald-100 text-emerald-800",
    canceled: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${map[status]}`}>
      {status === "released" && releasedAt ? `Released ${new Date(releasedAt).toLocaleDateString()}` : status}
    </span>
  );
}

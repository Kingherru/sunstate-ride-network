import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { EarningsLedger } from "@/components/portal/EarningsLedger";
import { NetworkSettlements } from "@/components/portal/NetworkSettlements";
import { SegTabs } from "@/components/portal/SegTabs";
import { usePortalPreview } from "@/components/portal/preview-data";

/** One financial page: operational driver earnings are kept separate from Network settlement records. No cash-out or release controls. */
export function EarningsPayments({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"drivers" | "network" | "provider" | "payouts">("drivers");
  const preview = usePortalPreview();
  return <div className="space-y-5"><SegTabs label="Earnings sections" value={tab} onChange={setTab} options={[
    { value: "drivers", label: "Driver & contractor earnings" }, { value: "network", label: "Network settlements" },
    { value: "provider", label: "Provider balance" }, { value: "payouts", label: "Payment & payout history" },
  ]} />
    <p className="ds-support rounded-ds border border-ds-sky-border bg-ds-sky p-3">Operational earnings and Network settlement records are tracked separately. These are app records, not a bank or escrow account. Membership invoices and payments are in <Link to="/portal/account" className="font-semibold text-ds-primary underline">Settings → Membership & Billing</Link>.</p>
    {preview.active ? <p className="ds-body rounded-ds border border-ds-sky-border bg-ds-sky p-5">No financial records in preview.</p>
      : tab === "drivers" ? <div className="space-y-5"><EarningsLedger /><DriverEarningsPanel /></div> : tab === "network" ? <NetworkSettlements /> : tab === "provider" ? <ProviderBalancePanel /> : <PayoutsPanel userId={userId} />}</div>;
}

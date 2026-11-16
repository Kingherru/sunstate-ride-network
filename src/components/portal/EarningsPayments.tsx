import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { EarningsLedger } from "@/components/portal/EarningsLedger";
import { NetworkSettlements } from "@/components/portal/NetworkSettlements";
import { PortalTabbedLayout } from "@/components/portal/PortalTabbedLayout";
import { usePortalPreview } from "@/components/portal/preview-data";
import { PreviewFinancialExamples } from './PreviewFinancialExamples';

/** One financial page: operational driver earnings are kept separate from Network settlement records. No cash-out or release controls. */
export function EarningsPayments({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"drivers" | "network" | "provider" | "payouts">("drivers");
  const preview = usePortalPreview();
  return <div className="space-y-5"><PortalTabbedLayout label="Earnings sections" queryKey="view" value={tab} onChange={setTab} options={[
    { value: "drivers", label: "Driver & contractor earnings" }, { value: "network", label: "Network settlements" },
    { value: "provider", label: "Provider balance" }, { value: "payouts", label: "Payment & payout history" },
  ]} >
    <p className="ds-support bg-ds-sky p-3">Financial execution OFF · These records do not represent a bank balance. <Link to="/portal/account" search={{section:'membership'}} className="font-semibold text-ds-primary underline">Membership & billing settings</Link></p>
    {preview.active ? <PreviewFinancialExamples section={tab}/>
      : tab === "drivers" ? <div className="space-y-5"><EarningsLedger /><DriverEarningsPanel /></div> : tab === "network" ? <NetworkSettlements /> : tab === "provider" ? <ProviderBalancePanel /> : <PayoutsPanel userId={userId} />}</PortalTabbedLayout></div>;
}

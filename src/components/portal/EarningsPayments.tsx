import { useState } from "react";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";
import { ProviderBalancePanel } from "@/components/dashboard/ProviderBalancePanel";
import { PayoutsPanel } from "@/components/dashboard/PayoutsPanel";
import { SegTabs } from "@/components/portal/SegTabs";
import { usePortalPreview } from "@/components/portal/preview-data";

export function EarningsPayments({ userId }: { userId: string }) {
  const [tab, setTab] = useState<"drivers" | "provider" | "payouts">("drivers");
  const preview = usePortalPreview();
  return <div className="space-y-5"><SegTabs label="Earnings sections" value={tab} onChange={setTab} options={[
    { value: "drivers", label: "Driver earnings & payments" }, { value: "provider", label: "Provider earnings" }, { value: "payouts", label: "Payment & payout history" },
  ]} />{preview.active ? <p className="ds-body rounded-ds border border-ds-sky-border bg-ds-sky p-5">No financial records in preview.</p> : tab === "drivers" ? <DriverEarningsPanel /> : tab === "provider" ? <ProviderBalancePanel /> : <PayoutsPanel userId={userId} />}</div>;
}
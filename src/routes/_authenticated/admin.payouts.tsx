import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { AdminFinanceMonitoring } from "@/components/admin/AdminFinanceMonitoring";
import { AdminPayoutQueue } from "@/components/admin/AdminPayoutQueue";

export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Payouts — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPayouts,
});

function AdminPayouts() {
  return (
    <>
      <PageHead title="Payouts">Review only during this phase. Payout releases stay off until final payment movement is approved.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <div className="space-y-8"><AdminFinanceMonitoring /><AdminPayoutQueue /></div>
      </section>
    </>
  );
}

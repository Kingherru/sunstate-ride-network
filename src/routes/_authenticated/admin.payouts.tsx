import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { PayoutsReview } from "@/components/admin/PayoutsReview";



export const Route = createFileRoute("/_authenticated/admin/payouts")({
  head: () => ({ meta: [{ title: "Payouts & Reconciliation — MY FLORIDA NEMT" }, { name: 'description', content: 'Restricted payout evidence and sandbox financial reconciliation review.' }, { property: 'og:title', content: 'Payouts & Reconciliation — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Restricted payout evidence and sandbox financial reconciliation review.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPayouts,
});

function AdminPayouts() {
  return (
    <>
      <PageHead title="Payouts">Review only during this phase. Payout releases stay off until final payment movement is approved.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <PayoutsReview />
      </section>
    </>
  );
}

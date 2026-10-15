import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Pricing — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPricing,
});

function AdminPricing() {
  return (
    <>
      <PageHead title="Pricing">Changes here affect future price estimates only. No money moves from this page.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <AdminPricingPanel />
      </section>
    </>
  );
}

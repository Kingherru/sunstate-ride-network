import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { AdminPricingPanel } from "@/components/admin/AdminPricingPanel";
import {ContractorConfiguration} from '@/components/admin/ContractorConfiguration';

export const Route = createFileRoute("/_authenticated/admin/pricing")({
  head: () => ({ meta: [{ title: "Pricing — MY FLORIDA NEMT" },{name:'description',content:'Platform pricing and contractor membership preparation.'},{property:'og:title',content:'Pricing — MY FLORIDA NEMT'},{property:'og:description',content:'Platform pricing and contractor configuration.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'}, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminPricing,
});

function AdminPricing() {
  return (
    <>
      <PageHead title="Pricing">Changes here affect future price estimates only. No money moves from this page.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <AdminPricingPanel />
        <div className="mt-8 border-t border-ds-border pt-6"><ContractorConfiguration/></div>
      </section>
    </>
  );
}

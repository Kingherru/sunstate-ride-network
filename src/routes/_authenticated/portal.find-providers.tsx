import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FacilityProvidersPanel } from "@/components/dashboard/FacilityProvidersPanel";

export const Route = createFileRoute("/_authenticated/portal/find-providers")({
  head: () => ({ meta: [{ title: "Find Providers — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalFindProviders,
});

function PortalFindProviders() {
  return (
    <>
      <PageHead title="Find Providers">Network providers in your area. Only details providers publish for network discovery are shown.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <FacilityProvidersPanel initialMode="lookup" />
      </section>
    </>
  );
}

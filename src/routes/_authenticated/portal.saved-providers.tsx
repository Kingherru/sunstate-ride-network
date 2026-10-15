import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FacilityProvidersPanel } from "@/components/dashboard/FacilityProvidersPanel";

export const Route = createFileRoute("/_authenticated/portal/saved-providers")({
  head: () => ({ meta: [{ title: "Saved Providers — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalSavedProviders,
});

function PortalSavedProviders() {
  return (
    <>
      <PageHead title="Saved Providers" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <FacilityProvidersPanel initialMode="saved" />
      </section>
    </>
  );
}

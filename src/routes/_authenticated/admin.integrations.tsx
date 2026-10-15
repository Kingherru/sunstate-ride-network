import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { PlatformWebhooksPanel } from "@/components/PlatformWebhooksPanel";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminIntegrations,
});

function AdminIntegrations() {
  return (
    <>
      <PageHead title="Integrations" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <PlatformWebhooksPanel />
      </section>
    </>
  );
}

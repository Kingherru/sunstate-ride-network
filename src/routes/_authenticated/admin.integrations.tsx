import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { PlatformWebhooksPanel } from "@/components/PlatformWebhooksPanel";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  head: () => ({ meta: [{ title: "Integrations — MY FLORIDA NEMT" }, { name: 'description', content: 'Manage authorized platform connections and integration settings.' }, { property: 'og:title', content: 'Integrations — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Authorized platform connections and integration settings.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminIntegrations,
});

function AdminIntegrations() {
  return (
    <>
      <PageHead title="Integrations" />
      <section className="portal-admin-module min-w-0">
        <PlatformWebhooksPanel />
      </section>
    </>
  );
}

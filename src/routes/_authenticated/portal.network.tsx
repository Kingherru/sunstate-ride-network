import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderDirectory } from "@/components/network/ProviderDirectory";

export const Route = createFileRoute("/_authenticated/portal/network")({
  head: () => ({ meta: [{ title: "Provider Network — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalNetwork,
});

function PortalNetwork() {
  return (
    <>
      <PageHead title="Provider network">Browse other verified providers in the network. Only details providers publish for network discovery are shown.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ProviderDirectory />
      </section>
    </>
  );
}

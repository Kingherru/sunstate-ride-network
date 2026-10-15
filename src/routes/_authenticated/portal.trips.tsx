import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderTrips } from "@/components/portal/ProviderTrips";

export const Route = createFileRoute("/_authenticated/portal/trips")({
  head: () => ({ meta: [{ title: "Trips — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalTrips,
});

function PortalTrips() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <PageHead title="Trips">Trips offered or assigned to your company. There is no open pool of other companies' trips.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ProviderTrips userId={user.id} />
      </section>
    </>
  );
}

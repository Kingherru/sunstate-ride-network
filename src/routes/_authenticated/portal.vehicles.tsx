import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FleetPanel } from "@/components/dashboard/FleetPanel";

export const Route = createFileRoute("/_authenticated/portal/vehicles")({
  head: () => ({ meta: [{ title: "Vehicles — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalVehicles,
});

function PortalVehicles() {
  return (
    <>
      <PageHead title="Vehicles" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <FleetPanel only="vehicles" />
      </section>
    </>
  );
}

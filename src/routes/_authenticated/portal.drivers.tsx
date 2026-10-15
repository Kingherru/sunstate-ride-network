import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";

export const Route = createFileRoute("/_authenticated/portal/drivers")({
  head: () => ({ meta: [{ title: "Drivers — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalDrivers,
});

function PortalDrivers() {
  return (
    <>
      <PageHead title="Drivers" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <div className="space-y-8"><FleetPanel only="drivers" /><DriverEarningsPanel /></div>
      </section>
    </>
  );
}

import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FleetPanel } from "@/components/dashboard/FleetPanel";
import { DriverEarningsPanel } from "@/components/dashboard/DriverEarningsPanel";

export const Route = createFileRoute("/_authenticated/portal/drivers")({
  head: () => ({ meta: [{ title: "Drivers — MY FLORIDA NEMT" }, { name: "description", content: "Open the drivers section of Fleet & Drivers." }, { property: "og:title", content: "Drivers — MY FLORIDA NEMT" }, { property: "og:description", content: "Manage authorized drivers." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => { throw redirect({ to: "/portal/fleet", search: { section: "drivers" } }); },
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

import { createFileRoute, redirect } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { FleetPanel } from "@/components/dashboard/FleetPanel";

export const Route = createFileRoute("/_authenticated/portal/vehicles")({
  head: () => ({ meta: [{ title: "Vehicles — MY FLORIDA NEMT" }, { name: "description", content: "Open the vehicles section of Fleet & Drivers." }, { property: "og:title", content: "Vehicles — MY FLORIDA NEMT" }, { property: "og:description", content: "Manage authorized vehicles." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => { throw redirect({ to: "/portal/fleet", search: { section: "vehicles" } }); },
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

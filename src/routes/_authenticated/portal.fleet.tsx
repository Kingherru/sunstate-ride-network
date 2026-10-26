import { createFileRoute } from "@tanstack/react-router";
import { FleetDrivers } from "@/components/portal/FleetDrivers";
import { PageHead } from "@/components/portal/PortalShell";

export const Route = createFileRoute("/_authenticated/portal/fleet")({
  validateSearch: (s: Record<string, unknown>): { section: "vehicles" | "drivers" } => ({ section: s.section === "drivers" ? "drivers" : "vehicles" }),
  head: () => ({ meta: [{ title: "Fleet & Drivers — MY FLORIDA NEMT" }, { name: "description", content: "Manage authorized vehicles, drivers and contractors." }, { property: "og:title", content: "Fleet & Drivers — MY FLORIDA NEMT" }, { property: "og:description", content: "Manage authorized vehicles, drivers and contractors." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Fleet,
});
function Fleet() { const { section } = Route.useSearch(); return <><PageHead title="Fleet & Drivers" /><FleetDrivers key={section} initial={section} /></>; }
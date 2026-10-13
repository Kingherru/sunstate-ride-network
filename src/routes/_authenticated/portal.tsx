import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { PortalShell } from "@/components/portal/PortalShell";

const NAV = [
  { to: "/portal", label: "Home", exact: true },
  { to: "/portal/requests", label: "Requests" },
  { to: "/portal/account", label: "Account" },
];

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    // Server-verified: training-only learners go to Training, suspended/pending to their status page.
    const access = await getAccessState();
    if (!access.isAdmin && access.destination !== "/portal") throw redirect({ to: access.destination });
    return { access };
  },
  component: () => (
    <PortalShell nav={NAV} area="Portal">
      <Outlet />
    </PortalShell>
  ),
});

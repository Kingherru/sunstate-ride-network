import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { PortalShell } from "@/components/portal/PortalShell";

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/requests", label: "Requests" },
];

// Verified MFN Admin only. Every admin server function re-checks the role server-side.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    const access = await getAccessState();
    if (!access.isAdmin) throw redirect({ to: access.destination === "/admin" ? "/account-status" : access.destination });
  },
  component: () => (
    <PortalShell nav={NAV} area="MFN Admin">
      <Outlet />
    </PortalShell>
  ),
});

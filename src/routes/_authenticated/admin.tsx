import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { PortalShell } from "@/components/portal/PortalShell";

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/people", label: "People & accounts" },
  { to: "/admin/messaging", label: "Messaging" },
  { to: "/admin/pricing", label: "Pricing" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/notifications", label: "Notifications" },
  { to: "/admin/security", label: "Security" },
];

// Verified MFN Admin only. Every admin server function re-checks the role server-side.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    const access = await getAccessState();
    if (!access.isAdmin) throw redirect({ to: access.destination === "/admin" ? "/account-status" : access.destination });
    return { access };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { access, user } = Route.useRouteContext();
  return (
    <PortalShell nav={NAV} area="MFN Admin" changelogTo="/admin/changelog"
      identity={{ name: access.displayName || user.email || "Administrator", mfnId: access.mfnId, label: "Administrator", badge: access.isMasterAdmin ? "Master Admin" : undefined }}>
      <Outlet />
    </PortalShell>
  );
}

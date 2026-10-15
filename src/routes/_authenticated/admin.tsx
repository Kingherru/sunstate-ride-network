import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { getMyAdminPermissions } from "@/lib/admin-management.functions";
import { canOpen } from "@/lib/admin-permissions";
import { PRESET_LABELS, type AdminPreset } from "@/lib/admin-permissions";
import { PortalShell } from "@/components/portal/PortalShell";
import { ADMIN_NAV } from "@/components/portal/portal-nav";

export { ADMIN_NAV as NAV };

// Verified admin label required; each section also needs a Master-Admin grant.
// Every admin server function and row-level rule re-checks this server-side.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const access = await getAccessState();
    if (!access.isAdmin) throw redirect({ to: access.destination === "/admin" ? "/account-status" : access.destination });
    const perms = await getMyAdminPermissions();
    const path = location.pathname.replace(/\/$/, "") || "/admin";
    if (path !== "/admin" && path !== "/admin/changelog" && path !== "/admin/settings" && !path.startsWith("/admin/preview") && !canOpen(path, perms)) throw redirect({ to: "/admin" });
    return { access, perms };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { access, perms } = Route.useRouteContext();
  const nav = ADMIN_NAV.filter((n) => canOpen(n.to, perms));
  const preset = (perms as { preset?: AdminPreset }).preset;
  const label = access.isMasterAdmin ? "MASTER ADMIN" : preset && preset !== "custom" && PRESET_LABELS[preset] ? PRESET_LABELS[preset].toUpperCase() : "CUSTOM ADMIN";
  return (
    <PortalShell nav={nav} area="MFN Admin" changelogTo="/admin/changelog" settingsTo="/admin/settings"
      notificationsTo={canOpen("/admin/notifications", perms) ? "/admin/notifications" : undefined}
      identity={{ name: "MY FLORIDA NEMT", mfnId: access.mfnId, label }}>
      <Outlet />
    </PortalShell>
  );
}

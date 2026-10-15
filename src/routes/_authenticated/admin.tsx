import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { getMyAdminPermissions } from "@/lib/admin-management.functions";
import { ADMIN_NAV_REQUIREMENT, levelAllows, type AccessLevel } from "@/lib/admin-permissions";
import { PortalShell } from "@/components/portal/PortalShell";

const NAV = [
  { to: "/admin", label: "Overview", exact: true },
  { to: "/admin/people", label: "People & accounts" },
  { to: "/admin/requests", label: "Requests" },
  { to: "/admin/on-behalf", label: "Request for a customer" },
  { to: "/admin/messaging", label: "Messaging" },
  { to: "/admin/pricing", label: "Pricing" },
  { to: "/admin/payouts", label: "Payouts" },
  { to: "/admin/integrations", label: "Integrations" },
  { to: "/admin/notifications", label: "Notifications" },
  { to: "/admin/admins", label: "Administrators" },
  { to: "/admin/security", label: "Security" },
];

export type AdminPerms = { master: boolean; sections: Record<string, string>; scope: string };

export function canOpen(path: string, p: AdminPerms) {
  if (p.master) return true;
  const key = Object.keys(ADMIN_NAV_REQUIREMENT).sort((a, b) => b.length - a.length).find((k) => path === k || path.startsWith(k + "/"));
  const need = key ? ADMIN_NAV_REQUIREMENT[key] : "master";
  if (need === null) return true;
  if (need === "master") return false;
  const lvl = p.sections[need] as AccessLevel | undefined;
  return path.startsWith("/admin/on-behalf") ? levelAllows(lvl, "manage") : levelAllows(lvl, "read");
}

// Verified admin label required; each section also needs a Master-Admin grant.
// Every admin server function and row-level rule re-checks this server-side.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const access = await getAccessState();
    if (!access.isAdmin) throw redirect({ to: access.destination === "/admin" ? "/account-status" : access.destination });
    const perms = await getMyAdminPermissions();
    const path = location.pathname.replace(/\/$/, "") || "/admin";
    if (path !== "/admin" && path !== "/admin/changelog" && path !== "/admin/settings" && !canOpen(path, perms)) throw redirect({ to: "/admin" });
    return { access, perms };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { access, perms, user } = Route.useRouteContext();
  const nav = NAV.filter((n) => canOpen(n.to, perms));
  return (
    <PortalShell nav={nav} area="MFN Admin" changelogTo="/admin/changelog"
      identity={{ name: access.displayName || user.email || "Administrator", mfnId: access.mfnId, label: "Administrator", badge: access.isMasterAdmin ? "Master Admin" : undefined }}>
      <Outlet />
    </PortalShell>
  );
}

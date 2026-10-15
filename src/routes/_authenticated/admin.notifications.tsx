import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminNotifications,
});

function AdminNotifications() {
  const level = useAdminLevel("notifications");
  return (
    <>
      <PageHead title="Notifications">{level === "read" && <ReadOnlyBadge />}</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <NotificationsPanel />
      </section>
    </>
  );
}

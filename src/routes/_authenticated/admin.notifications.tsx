import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Notifications — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminNotifications,
});

function AdminNotifications() {
  return (
    <>
      <PageHead title="Notifications" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <NotificationsPanel />
      </section>
    </>
  );
}

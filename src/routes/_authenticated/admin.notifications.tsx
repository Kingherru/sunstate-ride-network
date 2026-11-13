import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({ meta: [{ title: "Admin Notifications — MY FLORIDA NEMT" }, { name: 'description', content: 'Your authorized administrator notifications.' }, { property: 'og:title', content: 'Admin Notifications — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your authorized administrator notifications.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
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

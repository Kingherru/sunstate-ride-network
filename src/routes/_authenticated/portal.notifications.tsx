import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { Communications } from '@/components/portal/Communications';

export const Route = createFileRoute("/_authenticated/portal/notifications")({
  head: () => ({ meta: [{ title: "Notifications & Communications — MY FLORIDA NEMT" }, { name: 'description', content: 'Private notifications and prepared trip communication history.' }, { property: 'og:title', content: 'Notifications & Communications — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Authorized account notifications and trip communication previews.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalNotifications,
});

function PortalNotifications() {
  return (
    <>
      <PageHead title="Notifications" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <NotificationsPanel />
      </section>
      <section className="mt-6 border-t border-ds-border pt-5"><Communications /></section>
    </>
  );
}

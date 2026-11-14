import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { NotificationsPanel } from "@/components/dashboard/NotificationsPanel";
import { Communications } from '@/components/portal/Communications';
import { PortalTabbedLayout } from '@/components/portal/PortalTabbedLayout';
import { useState } from 'react';

export const Route = createFileRoute("/_authenticated/portal/notifications")({
  head: () => ({ meta: [{ title: "Notifications & Communications — MY FLORIDA NEMT" }, { name: 'description', content: 'Private notifications and prepared trip communication history.' }, { property: 'og:title', content: 'Notifications & Communications — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Authorized account notifications and trip communication previews.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalNotifications,
});

function PortalNotifications() {
  const [tab, setTab] = useState<'inbox' | 'communications'>('inbox');
  return (
    <>
      <PageHead title="Notifications" />
      <PortalTabbedLayout label="Notification views" queryKey="view" value={tab} onChange={setTab} options={[{ value: 'inbox', label: 'Inbox' }, { value: 'communications', label: 'Communications' }]} >
      <section hidden={tab !== 'inbox'} className={`${panelCls} p-4 sm:p-6`}>
        <NotificationsPanel />
      </section>
      <section hidden={tab !== 'communications'} className="mt-6 border-t border-ds-border pt-5"><Communications /></section>
    </PortalTabbedLayout>
    </>
  );
}

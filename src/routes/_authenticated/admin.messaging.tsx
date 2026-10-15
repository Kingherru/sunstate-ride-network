import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminMessaging,
});

function AdminMessaging() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <PageHead title="Messaging" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <MessagesPanel userId={user.id} portal="facility" />
      </section>
    </>
  );
}

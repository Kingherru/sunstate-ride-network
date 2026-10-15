import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminMessaging,
});

function AdminMessaging() {
  const { user } = Route.useRouteContext();
  const level = useAdminLevel("messaging");
  return (
    <>
      <PageHead title="Messaging">{level === "read" && <ReadOnlyBadge />}</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <MessagesPanel userId={user.id} portal="facility" />
      </section>
    </>
  );
}

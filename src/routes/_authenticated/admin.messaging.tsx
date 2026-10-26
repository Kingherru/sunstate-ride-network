import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";
import { WorkspaceMessaging } from "@/components/messaging/WorkspaceMessaging";
import { AdminPlatformRequests } from "@/components/messaging/PlatformRequests";
import { SegTabs } from "@/components/portal/SegTabs";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminMessaging,
});

type Tab = "messages" | "requests";

function AdminMessaging() {
  const { user } = Route.useRouteContext();
  const level = useAdminLevel("messaging");
  const [tab, setTab] = useState<Tab>("messages");
  return (
    <>
      <PageHead title="Messaging">{level === "read" && <ReadOnlyBadge />}</PageHead>
      <div className="mb-5">
        <SegTabs label="Messaging sections" value={tab} onChange={setTab} options={[{ value: "messages", label: "Messages" }, { value: "requests", label: "Requests" }]} />
      </div>
      {tab === "requests" ? (
        <section className={`${panelCls} p-4 sm:p-6`}>
          <AdminPlatformRequests canManage={level === "manage"} />
        </section>
      ) : (
        <>
          <section className={`${panelCls} p-4 sm:p-6`}>
            <MessagesPanel userId={user.id} portal="facility" readOnly={level !== 'manage'} />
          </section>

          <div className="mt-8">
            <PageHead title="Business conversations">{level === "read" && <ReadOnlyBadge />}</PageHead>
            <section className={`${panelCls} p-4 sm:p-6`}>
              <WorkspaceMessaging mode="admin" readOnly={level !== "manage"} />
            </section>
          </div>
        </>
      )}
    </>
  );
}

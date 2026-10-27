import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { MessagesPanel } from "@/components/dashboard/MessagesPanel";
import { WorkspaceMessaging } from "@/components/messaging/WorkspaceMessaging";
import { AdminPlatformRequests } from "@/components/messaging/PlatformRequests";
import { FrontendContacts } from "@/components/messaging/FrontendContacts";
import { DistributionActivity } from "@/components/portal/TripNetwork";
import { NetworkEligibility } from "@/components/portal/NetworkEligibility";
import { DemoConversations } from "@/components/messaging/DemoConversations";
import { SegTabs } from "@/components/portal/SegTabs";
import { useAdminLevel } from "@/lib/use-admin-level";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

type Tab = "messages" | "requests" | "business" | "contacts";
const TABS: Tab[] = ["messages", "requests", "business", "contacts"];

export const Route = createFileRoute("/_authenticated/admin/messaging")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab; to?: string } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : undefined,
    to: typeof s.to === "string" && /^[0-9a-f-]{36}$/i.test(s.to) ? s.to : undefined,
  }),
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT" }, { name: "description", content: "Admin messages, requests, business conversations and website contacts." }, { property: "og:title", content: "Messaging — MY FLORIDA NEMT" }, { property: "og:description", content: "Protected admin messaging." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminMessaging,
});

function AdminMessaging() {
  const { user, access } = Route.useRouteContext() as any;
  const level = useAdminLevel("messaging");
  const { tab = "messages", to } = Route.useSearch();
  const navigate = Route.useNavigate();
  const readOnly = level !== "manage";
  return (
    <>
      <PageHead title="Messaging">{level === "read" && <ReadOnlyBadge />}</PageHead>
      <div className="mb-5">
        <SegTabs label="Messaging sections" value={tab} onChange={(t) => navigate({ search: { tab: t === "messages" ? undefined : t } })} options={[
          { value: "messages", label: "Messages" }, { value: "requests", label: "Requests" },
          { value: "business", label: "Business Conversations" }, { value: "contacts", label: "Frontend Contacts" },
        ]} />
      </div>
      <section className={`${panelCls} p-4 sm:p-6`}>
        {tab === "requests" && <AdminPlatformRequests canManage={!readOnly} />}
        {tab === "messages" && <>{to && <p className="ds-support mb-3 border-b border-ds-border pb-3">Opened from People &amp; Accounts — the conversation with this person is selected when one exists. Start one from their account details if none appears.</p>}<MessagesPanel userId={user.id} portal="facility" readOnly={readOnly} focusUserId={to} emptyFallback={<DemoConversations kind="messages" />} /></>}
        {tab === "contacts" && <FrontendContacts canManage={!readOnly} />}
        {tab === "business" && (
          <>
            <WorkspaceMessaging mode="admin" readOnly={readOnly} />
            <div className="mt-8 border-t border-ds-border pt-6">
              <h2 className="ds-subheading mb-3 uppercase text-ds-primary">Network and referral activity</h2>
              <DistributionActivity admin />
              {access?.isMasterAdmin && <NetworkEligibility />}
            </div>
          </>
        )}
      </section>
    </>
  );
}

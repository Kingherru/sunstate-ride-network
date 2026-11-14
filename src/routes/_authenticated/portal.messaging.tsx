import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { WorkspaceMessaging } from "@/components/messaging/WorkspaceMessaging";
import { MessagesPanel } from '@/components/dashboard/MessagesPanel';
import { PortalTabbedLayout } from '@/components/portal/PortalTabbedLayout';

export const Route = createFileRoute("/_authenticated/portal/messaging")({
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT Portal" }, { name: "description", content: "Secure account and business conversations in your MY FLORIDA NEMT portal." }, { property: "og:title", content: "Messaging — MY FLORIDA NEMT Portal" }, { property: "og:description", content: "Secure account and business conversations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): { c?: string; tab?: string } => ({
    tab: typeof s.tab === 'string' ? s.tab : 'business',
    c: typeof s.c === "string" ? s.c : undefined,
  }),
  component: PortalMessaging,
});

function PortalMessaging() {
  const { user, access } = Route.useRouteContext();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <>
      <PageHead title={access.portalKind === 'provider' ? "Provider Network Messaging" : "Messaging"}>In-platform messages between businesses. No email or text messages are sent.</PageHead>
      <PortalTabbedLayout label="Messaging sections" value={search.tab === 'account' ? 'account' : 'business'} onChange={tab => navigate({ search: prev => ({ ...prev, tab }) })} options={[{ value: 'business', label: 'Business conversations' }, { value: 'account', label: 'Account conversations' }]} >
      <section hidden={search.tab === 'account'} className={`${panelCls} mb-8 p-4 sm:p-6`}>
        <WorkspaceMessaging
          mode="portal"
          initialConversationId={search.c ?? null}
          onConversationChange={(id) => navigate({ search: (prev) => ({ ...prev, c: id ?? undefined }), replace: true })}
        />
      </section>
      <section hidden={search.tab !== 'account'} className={`${panelCls} p-4 sm:p-6`}><MessagesPanel userId={user.id} portal={access.portalKind === 'provider' ? 'provider' : 'facility'} /></section>
    </PortalTabbedLayout>
    </>
  );
}

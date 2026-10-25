import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { WorkspaceMessaging } from "@/components/messaging/WorkspaceMessaging";
import { MessagesPanel } from '@/components/dashboard/MessagesPanel';

export const Route = createFileRoute("/_authenticated/portal/messaging")({
  head: () => ({ meta: [{ title: "Messaging — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): { c?: string } => ({
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
      <PageHead title="Account conversations" />
      <section className={`${panelCls} mb-8 p-4 sm:p-6`}><MessagesPanel userId={user.id} portal={access.workspace?.accountType === 'provider' ? 'provider' : 'facility'} /></section>
      <PageHead title="Messaging">Message other businesses in the Provider Network. Do not include patient or protected health information.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <WorkspaceMessaging
          mode="portal"
          initialConversationId={search.c ?? null}
          onConversationChange={(id) => navigate({ search: (prev) => ({ ...prev, c: id ?? undefined }), replace: true })}
        />
      </section>
    </>
  );
}

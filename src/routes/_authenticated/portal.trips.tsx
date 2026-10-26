import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ProviderTrips } from "@/components/portal/ProviderTrips";

export const Route = createFileRoute("/_authenticated/portal/trips")({
  head: () => ({ meta: [{ title: "Trips — MY FLORIDA NEMT" }, { name: 'description', content: 'Your created trips, accepted referrals, reservations, drafts and history.' }, { property: 'og:title', content: 'Trips — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your own trip operations, reservations and history.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalTrips,
});

function PortalTrips() {
  const { user } = Route.useRouteContext();
  return (
    <>
      <PageHead title="Trips" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ProviderTrips userId={user.id} />
      </section>
    </>
  );
}

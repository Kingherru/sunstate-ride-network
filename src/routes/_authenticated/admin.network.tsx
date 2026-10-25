import { createFileRoute } from '@tanstack/react-router';
import { PageHead } from '@/components/portal/PortalShell';
import { DistributionActivity } from '@/components/portal/TripNetwork';
import { NetworkEligibility } from '@/components/portal/NetworkEligibility';
export const Route = createFileRoute('/_authenticated/admin/network')({
  head: () => ({ meta: [{ title: 'Network Activity — MY FLORIDA NEMT Admin' }, { name: 'description', content: 'Review controlled distributions, addressed offers and negotiations.' }, { property: 'og:title', content: 'Network Activity — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Review controlled distributions, addressed offers and negotiations.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  component: NetworkPage,
});
function NetworkPage(){const {access}=Route.useRouteContext();return <><PageHead title="Network activity"/><DistributionActivity admin/>{access.isMasterAdmin&&<NetworkEligibility/>}</>;}
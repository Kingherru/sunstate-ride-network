import { createFileRoute } from "@tanstack/react-router";
import { ProviderNetworkPage } from '@/components/portal/ProviderNetworkPage';

export const Route = createFileRoute("/_authenticated/portal/network")({
  head: () => ({ meta: [{ title: "Provider Network — MY FLORIDA NEMT" }, { name: 'description', content: 'Provider-to-provider offers, referrals, proposed amounts and network connections.' }, { property: 'og:title', content: 'Provider Network — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Protected provider-to-provider network activity.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: ProviderNetworkPage,
});

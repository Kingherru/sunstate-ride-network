import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { Hero, NetworkConnect, Services, Membership } from "@/components/home/sections";
import { ProductDemo } from "@/components/home/ProductDemo";
import { FloridaMap } from "@/components/home/FloridaMap";

const TITLE = "My Florida NEMT | Florida Peer-to-Peer NEMT Network & Trip Booking";
const DESC = "A peer-to-peer Florida NEMT network: request transportation from independent providers, or connect provider-to-provider to share and review trip opportunities.";

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My Florida NEMT",
  url: "https://myfloridanemt.com/",
  description: "A Florida peer-to-peer NEMT network connecting customers and facilities with participating transportation providers, and providers with one another.",
};
const siteSchema = { "@context": "https://schema.org", "@type": "WebSite", name: "My Florida NEMT", url: "https://myfloridanemt.com/" };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://myfloridanemt.com/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/" }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(orgSchema) },
      { type: "application/ld+json", children: JSON.stringify(siteSchema) },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <Hero />
      <NetworkConnect />
      <ProductDemo motion />
      <FloridaMap />
      <Services />
      <Membership />
    </PublicPage>
  );
}

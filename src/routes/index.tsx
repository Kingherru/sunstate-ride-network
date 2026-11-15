import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { Hero, NetworkConnect, Services, Membership } from "@/components/home/sections";
import { ProductDemo } from "@/components/home/ProductDemo";
import { FloridaMap } from "@/components/home/FloridaMap";
import { ContractorSection } from '@/components/home/ContractorSection';

const TITLE = "MY FLORIDA NEMT | Florida Peer-to-Peer NEMT Network & Trip Booking";
const DESC = "A peer-to-peer Florida NEMT network: request transportation from independent providers, or connect provider-to-provider to share and review trip opportunities.";

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MY FLORIDA NEMT",
  url: "https://myfloridanemt.com/",
  description: "A Florida peer-to-peer NEMT network connecting customers and facilities with participating transportation providers, and providers with one another.",
};
const siteSchema = { "@context": "https://schema.org", "@type": "WebSite", name: "MY FLORIDA NEMT", url: "https://myfloridanemt.com/" };

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
      <FloridaMap motion />
      <Services />
      <ContractorSection />
      <section className="mfn-section bg-ds-sky text-ds-primary" aria-labelledby="future-transport">
        <div className="mfn-container mx-auto max-w-3xl text-center">
          <h2 id="future-transport" className="ds-section-title uppercase">Preparing for future transportation</h2>
          <p className="ds-body mt-4">MY FLORIDA NEMT is preparing its framework for future autonomous and self-driving NEMT transportation support. This is future development, not a service available today. When supported, it will use the same provider, vehicle, safety, scheduling and service-area framework. No regulatory approval, availability or launch date is promised.</p>
        </div>
      </section>
      <Membership />
    </PublicPage>
  );
}

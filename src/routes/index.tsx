import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { Hero, NetworkModel, Paths, Services, Founder, Membership, Training } from "@/components/home/sections";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductDemo } from "@/components/home/ProductDemo";
import { FloridaMap } from "@/components/home/FloridaMap";
import { CONTACT_INFO } from "@/lib/contact-info";

const TITLE = "My Florida NEMT | Florida Peer-to-Peer NEMT Network & Trip Booking";
const DESC = "A peer-to-peer Florida NEMT network: request transportation from independent providers, or connect provider-to-provider to share and review trip opportunities.";

const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "My Florida NEMT",
  url: "https://myfloridanemt.com",
  email: CONTACT_INFO.email,
  areaServed: { "@type": "State", name: "Florida" },
  ...(CONTACT_INFO.phone ? { telephone: CONTACT_INFO.phone } : {}),
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(orgSchema) }],
  }),
  component: Home,
});

function Home() {
  return (
    <PublicPage>
      <Hero />
      <NetworkModel />
      <Paths />
      <HowItWorks />
      <ProductDemo />
      <Membership />
      <Services />
      <FloridaMap />
      <Founder />
      <Training />
    </PublicPage>
  );
}

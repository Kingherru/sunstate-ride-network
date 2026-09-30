import { createFileRoute } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { Hero, Paths, Services, Founder, Membership, Training, FinalCta } from "@/components/home/sections";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductDemo } from "@/components/home/ProductDemo";
import { FloridaMap } from "@/components/home/FloridaMap";
import { CONTACT_INFO } from "@/lib/contact-info";

const TITLE = "My Florida NEMT | Book Transportation & Connect with Florida NEMT Providers";
const DESC = "Request non-emergency medical transportation, explore provider connections and access practical NEMT tools and training through My Florida NEMT.";

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
      <Paths />
      <HowItWorks />
      <ProductDemo />
      <Services />
      <FloridaMap />
      <Founder />
      <Membership />
      <Training />
      <FinalCta />
    </PublicPage>
  );
}

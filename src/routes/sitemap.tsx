import { createFileRoute } from "@tanstack/react-router";
import { BrandName } from "@/components/brand/BrandName";
import { SITE } from "@/components/public/page-kit";
import { TRAINING } from "@/lib/site-config";

const TITLE = "HTML Sitemap — All Public Pages | MY FLORIDA NEMT";
const DESC = "Every public page on the MY FLORIDA NEMT website: services, how it works, providers, patients and facilities, training, resources and policies.";

export const Route = createFileRoute("/sitemap")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `${SITE}/sitemap` }],
  }),
  component: SiteMapPage,
});

const GROUPS: { h: string; items: { label: string; href: string }[] }[] = [
  { h: "Public Pages", items: [
    { label: "Home", href: "/" }, { label: "How It Works", href: "/how-it-works" }, { label: "Providers", href: "/for-providers" },
    { label: "Patients and Facilities", href: "/for-facilities" }, { label: "Coverage", href: "/florida-coverage" },
    { label: "Join the Provider Network", href: "/join" }, { label: "Submit Trip Request", href: "/book" },
  ] },
  { h: "Services", items: [
    { label: "Services Overview", href: "/services" }, { label: "Ambulatory", href: "/services#ambulatory" }, { label: "Wheelchair", href: "/services#wheelchair" },
    { label: "Stretcher or Specialized", href: "/services#stretcher" }, { label: "Medical Delivery", href: "/services#delivery" },
  ] },
  { h: "Training", items: [{ label: "Training Shop", href: "/shop" }, ...TRAINING.map((t) => ({ label: t.title, href: t.href }))] },
  { h: "Resources", items: [{ label: "Resources", href: "/resources" }, { label: "People Also Ask", href: "/frequently-asked-questions" }] },
  { h: "Policies", items: [{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Use", href: "/terms" }, { label: "Accessibility Statement", href: "/accessibility" }] },
];

const link = "ds-body-lg rounded-ds-sm text-ds-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus";

function SiteMapPage() {
  return (
    <div className="theme-public min-h-screen bg-ds-bg">
      <div className="mfn-container flex items-center justify-between py-6">
        <a href="/" aria-label="MY FLORIDA NEMT home"><BrandName className="text-xl" /></a>
        <a href="/" className="ds-button-text uppercase text-ds-link hover:underline underline-offset-4">Back to website</a>
      </div>
      <main id="main" className="mfn-container pb-20">
        <h1 className="ds-display mt-6 text-center uppercase text-ds-primary">Sitemap</h1>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g, i) => (
            <section key={g.h} aria-labelledby={`sm-${i}`} className="rounded-ds bg-ds-sky p-7">
              <h2 id={`sm-${i}`} className="ds-subheading uppercase tracking-[0.04em] text-ds-primary">{g.h}</h2>
              <ul className="mt-4 space-y-3">{g.items.map((x) => <li key={x.href}><a href={x.href} className={link}>{x.label}</a></li>)}</ul>
            </section>
          ))}
          <section aria-labelledby="sm-loc" className="rounded-ds bg-ds-sky p-7">
            <h2 id="sm-loc" className="ds-subheading uppercase tracking-[0.04em] text-ds-primary">Location Pages</h2>
            <p className="ds-body-lg mt-4 text-ds-text-2">Location pages are coming soon. Explore <a href="/florida-coverage" className={link}>Coverage</a> in the meantime.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

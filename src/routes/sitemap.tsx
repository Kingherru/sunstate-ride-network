import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicPage } from "@/components/public/PublicPage";
import { PageHero, pageHead } from "@/components/public/page-kit";

const DESC = "A list of every public page on the My Florida NEMT website, grouped for customers, facilities and providers.";

export const Route = createFileRoute("/sitemap")({
  head: () => pageHead("/sitemap", "Site Map | My Florida NEMT", DESC, "Site Map", "CollectionPage"),
  component: SiteMapPage,
});

type To = "/" | "/services" | "/how-it-works" | "/florida-coverage" | "/book" | "/for-facilities" | "/for-providers" | "/join" | "/shop" | "/login" | "/privacy" | "/terms" | "/accessibility";
const GROUPS: { h: string; items: { label: string; to: To; hash?: string }[] }[] = [
  { h: "Main", items: [{ label: "Home", to: "/" }, { label: "Services", to: "/services" }, { label: "How It Works", to: "/how-it-works" }, { label: "Florida Coverage", to: "/florida-coverage" }] },
  { h: "For customers and facilities", items: [{ label: "Book a Trip", to: "/book" }, { label: "For Facilities", to: "/for-facilities" }] },
  { h: "For providers", items: [{ label: "For Providers", to: "/for-providers" }, { label: "Membership", to: "/for-providers", hash: "membership" }, { label: "Join the Provider Network", to: "/join" }, { label: "Training", to: "/shop" }] },
  { h: "Account", items: [{ label: "Sign In", to: "/login" }] },
  { h: "Legal and accessibility", items: [{ label: "Privacy Policy", to: "/privacy" }, { label: "Terms of Use", to: "/terms" }, { label: "Accessibility Statement", to: "/accessibility" }] },
];

function SiteMapPage() {
  return (
    <PublicPage>
      <PageHero crumb="Site Map" eyebrow="MY FLORIDA NEMT" title="Site map" intro={<p>Every public page on the website, in one place.</p>} />
      <div className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GROUPS.map((g) => (
            <section key={g.h} aria-labelledby={`sm-${g.h}`} className="rounded-ds bg-ds-subtle p-7">
              <h2 id={`sm-${g.h}`} className="ds-subheading uppercase tracking-[0.04em] text-ds-primary">{g.h}</h2>
              <ul className="mt-4 space-y-3">
                {g.items.map((i) => (
                  <li key={i.label}><Link to={i.to} hash={i.hash} className="ds-body-lg rounded-ds-sm text-ds-link hover:text-ds-link-hover hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">{i.label}</Link></li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </PublicPage>
  );
}

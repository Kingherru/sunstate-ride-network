import { Link } from "@tanstack/react-router";
import { BrandName } from "@/components/brand/BrandName";
import { PUBLIC_EMAIL, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";

type To = "/" | "/services" | "/how-it-works" | "/for-providers" | "/for-facilities" | "/florida-coverage" | "/shop" | "/login" | "/privacy" | "/terms" | "/accessibility" | "/sitemap";
type Item = { label: string; to: To; hash?: string };
const COLS: { title: string; items: Item[] }[] = [
  { title: "Services", items: [
    { label: "Ambulatory", to: "/services", hash: "ambulatory" },
    { label: "Wheelchair", to: "/services", hash: "wheelchair" },
    { label: "Stretcher or Specialized", to: "/services", hash: "stretcher" },
    { label: "Medical Delivery", to: "/services", hash: "delivery" },
  ] },
  { title: "Network", items: [
    { label: "How It Works", to: "/how-it-works" },
    { label: "Florida Coverage", to: "/florida-coverage" },
    { label: "For Providers", to: "/for-providers" },
    { label: "For Facilities", to: "/for-facilities" },
    { label: "Membership", to: "/for-providers", hash: "membership" },
  ] },
  { title: "Learn", items: [
    { label: "Training", to: "/shop" },
    { label: "Site Map", to: "/sitemap" },
  ] },
  { title: "Account", items: [
    { label: "Sign In", to: "/login" },
    { label: "Provider Portal", to: "/login" },
    { label: "Facility Portal", to: "/login" },
  ] },
];
const LEGAL: Item[] = [
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Accessibility", to: "/accessibility" },
  { label: "Site Map", to: "/sitemap" },
];

const linkCls = "ds-transition rounded-ds-sm uppercase tracking-[0.06em] opacity-90 hover:opacity-100 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary";

export function PublicFooter() {
  return (
    <footer className="bg-ds-primary text-ds-on-primary">
      <div className="mfn-container py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)] lg:gap-14">
          <div id="contact">
            <BrandName on="blue" className="text-2xl" />
            <p className="ds-body-lg mt-4 max-w-sm opacity-90">A Florida network connecting riders, facilities and independent NEMT providers.</p>
            <ul className="ds-body mt-6 space-y-3">
              <li>{PUBLIC_PHONE ? <a className={linkCls} href={phoneHref(PUBLIC_PHONE)}>{PUBLIC_PHONE}</a> : <span className="uppercase tracking-[0.06em] opacity-90">Call Us</span>}</li>
              <li><a className="ds-transition rounded-ds-sm opacity-90 hover:opacity-100 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a></li>
            </ul>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={`Footer ${c.title}`}>
              <h2 className="ds-label uppercase tracking-[0.08em] text-ds-accent">{c.title}</h2>
              <ul className="ds-body mt-5 space-y-3.5">
                {c.items.map((i) => (
                  <li key={i.label}><Link to={i.to} hash={i.hash} className={linkCls}>{i.label}</Link></li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-5 border-t border-ds-on-primary/20 pt-8 ds-body lg:flex-row lg:items-center lg:justify-between">
          <p className="opacity-80">© {new Date().getFullYear()} My Florida NEMT. Non-emergency transportation only — for emergencies call 911.</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {LEGAL.map((i) => <li key={i.label}><Link to={i.to} className={linkCls}>{i.label}</Link></li>)}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

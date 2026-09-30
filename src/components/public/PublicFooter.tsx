import { Link } from "@tanstack/react-router";
import { BrandName } from "@/components/brand/BrandName";
import { PUBLIC_EMAIL, PUBLIC_PHONE, phoneHref } from "@/lib/site-config";

type Item = { label: string; to: string; hash?: string };
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
    { label: "Resources", to: "/", hash: "resources" },
    { label: "Training", to: "/shop" },
    { label: "Contact", to: "/", hash: "contact" },
  ] },
  { title: "Account", items: [
    { label: "Sign In", to: "/login" },
    { label: "Provider Portal", to: "/login" },
    { label: "Facility Portal", to: "/login" },
  ] },
];

const linkCls = "ds-transition rounded-sm opacity-90 hover:opacity-100 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary";

export function PublicFooter() {
  return (
    <footer className="bg-ds-primary text-ds-on-primary">
      <div className="mfn-container py-14">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_repeat(4,1fr)] lg:gap-12">
          <div id="contact">
            <BrandName on="blue" className="text-2xl" />
            <p className="ds-body-lg mt-4 max-w-sm opacity-90">A Florida network connecting riders, facilities and independent NEMT providers.</p>
            <ul className="ds-body-lg mt-6 space-y-2">
              <li>{PUBLIC_PHONE ? <a className={linkCls} href={phoneHref(PUBLIC_PHONE)}>{PUBLIC_PHONE}</a> : <span className="uppercase tracking-[0.04em]">Call Us</span>}</li>
              <li><a className={linkCls} href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a></li>
            </ul>
          </div>
          {COLS.map((c) => (
            <div key={c.title}>
              <h2 className="ds-subheading">{c.title}</h2>
              <ul className="ds-body-lg mt-4 space-y-3">
                {c.items.map((i) => (
                  <li key={i.label}>
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <Link to={i.to as any} hash={i.hash} className={linkCls}>{i.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-ds-on-primary/20 pt-8 ds-body lg:flex-row lg:items-start lg:justify-between lg:gap-12">
          <p className="opacity-80">© {new Date().getFullYear()} My Florida NEMT. Non-emergency transportation only — for emergencies call 911.</p>
          <div>
            <h2 className="sr-only">Legal</h2>
            <p className="opacity-80">Privacy · Terms · Accessibility · Payment and Cancellation Policies — policy pages are being updated; email us for a copy.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

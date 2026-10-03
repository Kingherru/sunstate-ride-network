import { Link } from "@tanstack/react-router";
import { BrandName } from "@/components/brand/BrandName";
import { LINKS, PUBLIC_EMAIL, PUBLIC_PHONE, PUBLIC_PHONE_TEL, TRAINING } from "@/lib/site-config";

type Item = { label: string; href: string };
const COLS: { title: string; items: Item[] }[] = [
  { title: "Learn", items: [
    { label: "How It Works", href: "/how-it-works" },
    { label: "Services", href: "/services" },
    { label: "Coverage", href: "/florida-coverage" },
    { label: "Resources", href: "/resources" },
    { label: "People Also Ask", href: LINKS.faq },
  ] },
  { title: "Training", items: TRAINING.map((t) => ({ label: t.title, href: t.href })) },
  { title: "Account", items: [
    { label: "Sign In", href: "/login" },
    { label: "Create Account", href: LINKS.createAccount },
    { label: "Join the Provider Network", href: LINKS.join },
  ] },
];
const LEGAL: Item[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
  { label: "Sitemap", href: "/sitemap" },
];

const linkCls = "ds-transition rounded-ds-sm uppercase tracking-[0.06em] opacity-90 hover:opacity-100 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary";

export function PublicFooter() {
  return (
    <footer className="bg-ds-primary text-ds-on-primary">
      <div className="mfn-container py-16">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-14">
          <div id="contact">
            <Link to="/" className="rounded-ds-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary" aria-label="MY FLORIDA NEMT home"><BrandName on="blue" className="text-2xl" /></Link>
            <ul className="ds-body mt-6 space-y-3.5">
              <li><a className={linkCls} href={PUBLIC_PHONE_TEL}>{PUBLIC_PHONE}</a></li>
              <li><a className="ds-transition rounded-ds-sm opacity-90 hover:opacity-100 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary" href={`mailto:${PUBLIC_EMAIL}`}>{PUBLIC_EMAIL}</a></li>
            </ul>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={`Footer ${c.title}`}>
              <p className="ds-label uppercase tracking-[0.08em] text-ds-accent">{c.title}</p>
              <ul className="ds-body mt-5 space-y-3.5">
                {c.items.map((i) => <li key={i.label}><a href={i.href} className={linkCls}>{i.label}</a></li>)}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-14 flex flex-col gap-5 border-t border-ds-on-primary/20 pt-8 ds-body lg:flex-row lg:items-center lg:justify-between">
          <p className="uppercase tracking-[0.06em] opacity-80">© {new Date().getFullYear()} MY FLORIDA NEMT</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap gap-x-7 gap-y-3">
              {LEGAL.map((i) => <li key={i.label}><a href={i.href} className={linkCls}>{i.label}</a></li>)}
            </ul>
          </nav>
        </div>
      </div>
    </footer>
  );
}

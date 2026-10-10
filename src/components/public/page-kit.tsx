import { Link } from "@tanstack/react-router";
import { CalendarPlus, Info, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES, LINKS } from "@/lib/site-config";
import { HomeReveal } from "@/components/home/HomeReveal";
import { btnAction, btnBlue, btnLight, btnOnBlue } from "@/components/home/buttons";

export const SITE = "https://myfloridanemt.com";

/** Unique per-page head(): title, description, canonical, OG/Twitter. */
/** JSON-LD helpers: one script per block, no undefined values. */
export const ldScript = (data: object) => ({ type: "application/ld+json", children: JSON.stringify(data) });
export const breadcrumbLd = (path: string, name: string) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
    { "@type": "ListItem", position: 2, name, item: `${SITE}${path}` },
  ],
});
export const webPageLd = (path: string, name: string, description: string, type = "WebPage") => ({
  "@context": "https://schema.org",
  "@type": type,
  name,
  description,
  url: `${SITE}${path}`,
  isPartOf: { "@type": "WebSite", name: "MY FLORIDA NEMT", url: `${SITE}/` },
});

/** Interior page head: metadata + canonical + WebPage and BreadcrumbList JSON-LD. */
export function pageHead(path: string, title: string, description: string, crumb?: string, pageType?: string) {
  return {
    scripts: crumb ? [ldScript(webPageLd(path, crumb, description, pageType)), ...(path.startsWith("/resources") ? [ldScript(breadcrumbLd(path, crumb))] : [])] : [],
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}${path}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}${path}` }],
  };
}

type Img = (typeof HOME_IMAGES)[keyof typeof HOME_IMAGES];

/**
 * Standard inner-page banner: centered H1 + copy on blue, optional faint
 * decorative photo, breadcrumbs directly below. `eyebrow` is ignored (kept for compatibility).
 */
export function PageHero({ title, intro, img, children, crumb, showCrumbs }: { crumb?: string; showCrumbs?: boolean; eyebrow?: string; title: React.ReactNode; intro: React.ReactNode; img?: Img; children?: React.ReactNode }) {
  return (
    <>
      <section aria-labelledby="page-title" className="relative overflow-hidden bg-ds-primary text-ds-on-primary">
        {img && <img src={img.src} width={img.w} height={img.h} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-[0.14]" />}
        <div className="relative mfn-container py-16 lg:py-24">
          <HomeReveal className="mx-auto max-w-4xl text-center">
            <h1 id="page-title" className="ds-display uppercase">{title}</h1>
            <div className="ds-body-lg mx-auto mt-5 max-w-[46rem] space-y-3 text-[1.1875rem] opacity-95 sm:text-[1.25rem]">{intro}</div>
            {children && <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">{children}</div>}
          </HomeReveal>
        </div>
      </section>
      {crumb && showCrumbs && <Breadcrumbs crumb={crumb} />}
    </>
  );
}

/** Visible breadcrumbs (Home / page). Matches breadcrumbLd() emitted by pageHead(). */
export function Breadcrumbs({ crumb }: { crumb: string }) {
  return (
    <nav aria-label="Breadcrumb" className="bg-ds-surface">
      <ol className="mfn-container ds-support flex flex-wrap items-center gap-2 py-4 uppercase tracking-[0.06em]">
        <li><Link to="/" className="rounded-ds-sm text-ds-link hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">Home</Link></li>
        <li aria-hidden>/</li>
        <li aria-current="page" className="text-ds-on-surface">{crumb}</li>
      </ol>
    </nav>
  );
}

/** One-time entrance wrapper for public pages (same system as the homepage). */
export const Reveal = HomeReveal;

export function SectionHead({ eyebrow, title, intro, id, onBlue, align = "center" }: { eyebrow?: string; title: string; intro?: React.ReactNode; id: string; onBlue?: boolean; align?: "center" | "left" }) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center")}>
      {eyebrow && <p className={cn("ds-label", onBlue ? "text-ds-accent" : "text-ds-accent-active")}>{eyebrow}</p>}
      <h2 id={id} className={cn("ds-page-title mt-2 uppercase", !onBlue && "text-ds-primary")}>{title}</h2>
      {intro && <div className={cn("ds-body-lg mfn-read mt-4", align === "center" && "mx-auto", !onBlue && "text-ds-text-2")}>{intro}</div>}
    </div>
  );
}

/** Icon + text list item used for checklists. */
export function IconItem({ icon: Icon, children, tone = "bg-ds-sky" }: { icon: LucideIcon; children: React.ReactNode; tone?: string }) {
  return (
    <li className="flex gap-4 rounded-ds bg-ds-surface p-5 shadow-ds">
      <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-ds-sm text-ds-primary", tone)}><Icon className="size-6" aria-hidden /></span>
      <span className="ds-body-lg self-center">{children}</span>
    </li>
  );
}

/** Numbered steps with square indicators and a thin solid neutral line. */
export function Steps({ steps, tone = "bg-ds-primary text-ds-on-primary" }: { steps: { t: string; d?: string }[]; tone?: string }) {
  return (
    <ol className="relative grid gap-5">
      <span aria-hidden className="absolute bottom-6 left-6 top-6 w-px bg-ds-border-strong" />
      {steps.map((s, i) => (
        <li key={s.t} className="relative flex gap-5">
          <span className={cn("ds-subheading flex size-12 shrink-0 items-center justify-center rounded-ds-sm", tone)}>{i + 1}</span>
          <div className="pt-2.5">
            <h3 className="ds-subheading text-ds-primary">{s.t}</h3>
            {s.d && <p className="ds-body-lg mt-1 text-ds-text-2">{s.d}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Calm, non-alarming emergency notice. */
export function NonEmergencyNotice({ className }: { className?: string }) {
  return (
    <aside aria-label="Non-emergency notice" className={cn("flex gap-4 rounded-ds bg-ds-sand p-5 text-ds-on-soft sm:p-6", className)}>
      <Info className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />
      <p className="ds-body-lg">MY FLORIDA NEMT is for planned, non-emergency transportation coordination. It is not an emergency service. <strong>For a medical emergency, call 911.</strong></p>
    </aside>
  );
}

export type CtaAction = { label: string; to: string; icon: LucideIcon; kind?: "action" | "blue" | "light" };

/** Closing CTA: pale orange, dark-blue copy, centered, single-line buttons. Never blue above the blue footer. */
export function CtaBand({ title, text, actions, primary, secondary }: { title: string; text: string; actions?: CtaAction[]; primary?: CtaAction; secondary?: CtaAction }) {
  const list = actions ?? [primary, secondary].filter(Boolean) as CtaAction[];
  return (
    <section aria-labelledby="cta-title" className="mfn-section bg-ds-membership">
      <HomeReveal className="mfn-container mx-auto max-w-3xl text-center">
        <h2 id="cta-title" className="ds-page-title uppercase text-ds-primary">{title}</h2>
        <p className="ds-body-lg mx-auto mt-3 max-w-2xl text-ds-primary">{text}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {list.map((a, i) => {
            const cls = a.kind === "light" ? btnOnBlue : a.kind === "blue" || i > 0 ? btnBlue : btnAction;
            const inner = <><a.icon aria-hidden />{a.label}</>;
            return /^(tel:|mailto:|https?:)/.test(a.to)
              ? <a key={a.label} href={a.to} className={cls}>{inner}</a>
              : <a key={a.label} href={a.to} className={cls}>{inner}</a>;
          })}
        </div>
      </HomeReveal>
    </section>
  );
}

export function HeroActions({ secondary }: { secondary: "how" | "join" }) {
  return (
    <>
      <a href={LINKS.book} className={btnAction}><CalendarPlus aria-hidden />Book a Trip</a>
      {secondary === "join"
        ? <a href={LINKS.join} className={btnOnBlue}><Network aria-hidden />Join the Provider Network</a>
        : <Link to="/how-it-works" className={btnOnBlue}>How It Works</Link>}
    </>
  );
}

export { btnAction, btnBlue, btnLight, btnOnBlue };

import { Link } from "@tanstack/react-router";
import { CalendarPlus, Info, Network, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES, LINKS } from "@/lib/site-config";
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
  isPartOf: { "@type": "WebSite", name: "My Florida NEMT", url: `${SITE}/` },
});

/** Interior page head: metadata + canonical + WebPage and BreadcrumbList JSON-LD. */
export function pageHead(path: string, title: string, description: string, crumb?: string, pageType?: string) {
  return {
    scripts: crumb ? [ldScript(webPageLd(path, crumb, description, pageType)), ldScript(breadcrumbLd(path, crumb))] : [],
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

/** Blue page hero matching the homepage: copy left, photo right with same-color fade. */
export function PageHero({ eyebrow, title, intro, img, children, crumb }: { crumb?: string; eyebrow: string; title: React.ReactNode; intro: React.ReactNode; img?: Img; children?: React.ReactNode }) {
  return (
    <section aria-labelledby="page-title" className="relative overflow-hidden bg-ds-primary text-ds-on-primary">
      {img && (
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[48%]">
          <div className="relative aspect-[16/9] lg:aspect-auto lg:h-full">
            <img src={img.src} width={img.w} height={img.h} alt={img.alt} className="h-full w-full object-cover" />
            <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ds-primary to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-1/3 lg:bg-gradient-to-r" />
          </div>
        </div>
      )}
      <div className={cn("relative mfn-container pb-12 pt-8 lg:py-24", !img && "py-14 lg:py-20")}>
        <div className={cn(img ? "max-w-2xl lg:max-w-[48%]" : "max-w-4xl")}>
          {crumb && (
            <nav aria-label="Breadcrumb" className="ds-support mb-5 !text-ds-on-primary">
              <ol className="flex flex-wrap items-center gap-2 uppercase tracking-[0.06em] opacity-90">
                <li><Link to="/" className="rounded-ds-sm hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary">Home</Link></li>
                <li aria-hidden>/</li>
                <li aria-current="page">{crumb}</li>
              </ol>
            </nav>
          )}
          <p className="ds-label tracking-wide text-ds-accent">{eyebrow}</p>
          <h1 id="page-title" className="ds-display mt-4 uppercase">{title}</h1>
          <div className="ds-body-lg mt-5 max-w-[46rem] space-y-3 text-[1.1875rem] opacity-95 sm:text-[1.25rem]">{intro}</div>
          {children && <div className="mt-7 flex flex-col gap-3 sm:flex-row">{children}</div>}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ eyebrow, title, intro, id, onBlue }: { eyebrow?: string; title: string; intro?: React.ReactNode; id: string; onBlue?: boolean }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className={cn("ds-label", onBlue ? "text-ds-accent" : "text-ds-accent-active")}>{eyebrow}</p>}
      <h2 id={id} className={cn("ds-page-title mt-2", !onBlue && "text-ds-primary")}>{title}</h2>
      {intro && <div className={cn("ds-body-lg mfn-read mt-4", !onBlue && "text-ds-text-2")}>{intro}</div>}
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
      <p className="ds-body-lg">My Florida NEMT is for planned, non-emergency transportation coordination. It is not an emergency service. <strong>For a medical emergency, call 911.</strong></p>
    </aside>
  );
}

type Cta = { label: string; to: "/book" | "/join" | "/how-it-works" | "/shop" | "/for-providers"; icon: LucideIcon };

/** Closing CTA band with a primary + secondary action. */
export function CtaBand({ title, text, primary, secondary }: { title: string; text: string; primary: Cta; secondary: Cta }) {
  return (
    <section aria-labelledby="cta-title" className="mfn-section bg-ds-subtle">
      <div className="mfn-container flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="max-w-2xl">
          <h2 id="cta-title" className="ds-page-title text-ds-primary">{title}</h2>
          <p className="ds-body-lg mt-3 text-ds-text-2">{text}</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <Link to={primary.to} className={btnAction}><primary.icon aria-hidden />{primary.label}</Link>
          <Link to={secondary.to} className={btnBlue}><secondary.icon aria-hidden />{secondary.label}</Link>
        </div>
      </div>
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

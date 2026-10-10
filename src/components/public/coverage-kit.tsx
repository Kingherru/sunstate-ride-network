import { ArrowRight } from "lucide-react";
import { SITE, ldScript } from "@/components/public/page-kit";

export type Crumb = { name: string; path: string };

/** Multi-level visible breadcrumbs; last item is the current page. */
export function TrailCrumbs({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="bg-ds-surface">
      <ol className="mfn-container ds-support flex flex-wrap items-center gap-2 py-4 uppercase tracking-[0.06em]">
        {trail.map((c, i) => (
          <li key={c.path} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden>/</span>}
            {i === trail.length - 1
              ? <span aria-current="page" className="text-ds-on-surface">{c.name}</span>
              : <a href={c.path} className="rounded-ds-sm text-ds-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">{c.name}</a>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const trailLd = (trail: Crumb[]) => ldScript({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: trail.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE}${c.path}` })),
});

/** Interior head with multi-level breadcrumbs. */
export function trailHead(path: string, title: string, description: string, trail: Crumb[], withCrumbLd = false) {
  return {
    meta: [
      { title }, { name: "description", content: description },
      { property: "og:title", content: title }, { property: "og:description", content: description },
      { property: "og:type", content: "website" }, { property: "og:url", content: `${SITE}${path}` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: `${SITE}${path}` }],
    scripts: withCrumbLd ? [trailLd(trail)] : [],
  };
}

export function LinkCard({ href, title, text }: { href: string; title: string; text?: string }) {
  return (
    <a href={href} className="group flex h-full flex-col rounded-ds bg-ds-sky p-6 ds-transition hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
      <span className="ds-subheading uppercase text-ds-primary">{title}</span>
      {text && <span className="ds-body-lg mt-2 flex-1 text-ds-text-2">{text}</span>}
      <ArrowRight className="mt-4 size-5 text-ds-link ds-transition group-hover:translate-x-1" aria-hidden />
    </a>
  );
}

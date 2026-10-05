import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, Network, UserPlus } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, SITE, ldScript } from "@/components/public/page-kit";
import { TrailCrumbs, trailHead } from "@/components/public/coverage-kit";
import { getResource } from "@/lib/resources-content";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/resources/$slug")({
  loader: ({ params }) => { const r = getResource(params.slug); if (!r) throw notFound(); return r; },
  head: ({ loaderData: r }) => {
    if (!r) return {};
    const path = `/resources/${r.slug}`;
    const h = trailHead(path, r.metaTitle, r.description, trail(r.title, path));
    return { ...h, meta: [...h.meta.filter((m) => !("property" in m && m.property === "og:type")), { property: "og:type", content: "article" }],
      scripts: [...h.scripts, ldScript({ "@context": "https://schema.org", "@type": "Article", headline: r.title, description: r.description, dateModified: r.reviewed,
        author: { "@type": "Organization", name: "MY FLORIDA NEMT" }, publisher: { "@type": "Organization", name: "MY FLORIDA NEMT" }, mainEntityOfPage: `${SITE}${path}` })] };
  },
  component: ResourcePage,
});

const trail = (t: string, path: string) => [{ name: "Home", path: "/" }, { name: "Resources", path: "/resources" }, { name: t, path }];
const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

function ResourcePage() {
  const r = Route.useLoaderData();
  return (
    <PublicPage>
      <PageHero title={r.title} intro={<p>{r.description}</p>} />
      <TrailCrumbs trail={trail(r.title, `/resources/${r.slug}`)} />
      <article className="mfn-section bg-ds-bg">
        <div className="mfn-container mfn-read mx-auto">
          <p className="ds-support uppercase tracking-[0.06em] text-ds-text-2">{r.audience} · Reviewed <time dateTime={r.reviewed}>{fmt(r.reviewed)}</time></p>
          {r.body.map((b, i) => b.t === "h2" ? <h2 key={i} className="ds-section-title mt-10 uppercase text-ds-primary">{b.c}</h2>
            : b.t === "p" ? <p key={i} className="ds-body-lg mt-4">{b.c}</p>
            : b.t === "ul" ? <ul key={i} className="ds-body-lg mt-4 list-disc space-y-2 pl-6">{b.items.map((x) => <li key={x}>{x}</li>)}</ul>
            : "items" in b ? <ol key={i} className="ds-body-lg mt-4 list-decimal space-y-2 pl-6">{b.items.map((x) => <li key={x}>{x}</li>)}</ol> : null)}
          <p className="ds-body-lg mt-10">Related: {r.related.map((l, i) => <span key={l.href}>{i > 0 && " · "}<a href={l.href} className="text-ds-link underline underline-offset-4">{l.label}</a></span>)} · <a href="/resources" className="text-ds-link underline underline-offset-4">All resources</a></p>
        </div>
      </article>
      {r.cta === "join"
        ? <CtaBand title="Grow with the provider network" text="Join MY FLORIDA NEMT to share and review trip opportunities provider-to-provider." actions={[{ label: "Join the Provider Network", to: LINKS.join, icon: Network }, { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus }]} />
        : <CtaBand title="Ready to request a trip?" text="Share the trip details and participating Florida providers can review your request." actions={[{ label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus }, { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus }]} />}
    </PublicPage>
  );
}

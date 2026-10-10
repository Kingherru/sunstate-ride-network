import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArrowRight, CalendarPlus, Phone, UserPlus } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SITE, ldScript, pageHead } from "@/components/public/page-kit";
import { getServicePage } from "@/lib/services-content";
import { HOME_IMAGES, LINKS, PUBLIC_PHONE_TEL } from "@/lib/site-config";

export const Route = createFileRoute("/services/$service")({
  loader: ({ params }) => {
    const page = getServicePage(params.service);
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const path = `/services/${loaderData.slug}`;
    const base = pageHead(path, loaderData.title, loaderData.description);
    const service = {
      "@context": "https://schema.org", "@type": "Service",
      name: loaderData.name, serviceType: loaderData.serviceType, description: loaderData.description,
      url: `${SITE}${path}`, areaServed: { "@type": "State", name: "Florida" },
      provider: { "@type": "Organization", name: "MY FLORIDA NEMT", url: `${SITE}/` },
    };
    return { ...base, meta: [...base.meta, { name: "keywords", content: loaderData.keyword }], scripts: [ldScript(service)] };
  },
  notFoundComponent: () => <PublicPage><PageHero title="Service not found" intro={<p><a className="underline" href="/services">See all services</a></p>} /></PublicPage>,
  component: ServiceDetail,
});

function ServiceDetail() {
  const s = Route.useLoaderData();
  const img = HOME_IMAGES[s.imageKey];
  const book = s.bookParam ? `${LINKS.book}?service=${s.bookParam}` : LINKS.book;
  return (
    <PublicPage>
      <PageHero title={s.h1} intro={<p>{s.intro}</p>} />

      <section className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
          <article className="mfn-read space-y-10">
            {s.sections.map((sec, i) => (
              <Reveal key={sec.h} delay={i * 40}>
                <h2 className="ds-section-title uppercase text-ds-primary">{sec.h}</h2>
                {sec.p?.map((p) => <p key={p.slice(0, 24)} className="ds-body-lg mt-4 text-ds-on-surface">{p}</p>)}
                {sec.list && <ul className="ds-body-lg mt-4 list-disc space-y-2 pl-6 text-ds-on-surface">{sec.list.map((x) => <li key={x}>{x}</li>)}</ul>}
              </Reveal>
            ))}
          </article>
          <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
            <Reveal direction="right">
              <img src={img.src} width={img.w} height={img.h} alt={s.imageAlt} loading="lazy" className="w-full rounded-ds-lg object-cover" />
            </Reveal>
            <div className="rounded-ds bg-ds-sky p-6">
              <h2 className="ds-subheading uppercase text-ds-primary">Related</h2>
              <ul className="mt-3 space-y-2">
                {s.related.map((r) => <li key={r.href}><a href={r.href} className="ds-body-lg inline-flex items-center gap-2 text-ds-link hover:underline underline-offset-4">{r.label}<ArrowRight className="size-4" aria-hidden /></a></li>)}
              </ul>
            </div>
          </aside>
        </div>
      </section>

      <CtaBand title={s.cta.title} text={s.cta.text} actions={[
        { label: "Submit Trip Request", to: book, icon: CalendarPlus },
        { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
        { label: "Call Us", to: PUBLIC_PHONE_TEL, icon: Phone },
      ]} />
    </PublicPage>
  );
}

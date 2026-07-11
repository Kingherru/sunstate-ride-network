import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CITIES, type CitySlug } from "@/lib/cities";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

const NAVY = "#13335a";
const ORANGE = "#e07a1f";
const MINT = "#FFF3E4";
const CREAM = "#FFF8EE";

export const Route = createFileRoute("/service-areas/$city")({
  loader: ({ params }) => {
    const city = CITIES[params.city as CitySlug];
    if (!city) throw notFound();
    return { city };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.city;
    const title = c?.seoTitle ?? "Service Area — My Florida NEMT";
    const description = c?.seoDescription ?? "My Florida NEMT coverage detail.";
    const url = `https://myfloridanemt.com/service-areas/${params.city}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: c
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "MedicalBusiness",
                name: `My Florida NEMT — ${c.name}`,
                description,
                url,
                areaServed: { "@type": "City", name: c.name, addressRegion: "FL", addressCountry: "US" },
                telephone: "+1-800-555-0199",
                provider: {
                  "@type": "Organization",
                  name: "My Florida NEMT",
                  url: "https://myfloridanemt.com",
                },
                hasOfferCatalog: {
                  "@type": "OfferCatalog",
                  name: `NEMT Services in ${c.name}`,
                  itemListElement: c.services.map((s) => ({
                    "@type": "Offer",
                    itemOffered: {
                      "@type": "Service",
                      name: `${s.name} — ${c.name}`,
                      description: s.copy,
                      url: `https://myfloridanemt.com/services/${s.slug}`,
                    },
                  })),
                },
              }),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "https://myfloridanemt.com/" },
                  { "@type": "ListItem", position: 2, name: "Service Areas", item: "https://myfloridanemt.com/service-areas" },
                  { "@type": "ListItem", position: 3, name: c.name, item: url },
                ],
              }),
            },
          ]
        : [],
    };
  },
  notFoundComponent: () => (
    <div className="py-32 text-center px-6">
      <h1 className="text-4xl font-extrabold tracking-tighter">City not found</h1>
      <p className="text-muted mt-4">
        <Link to="/service-areas" className="text-primary font-bold underline">
          See all service areas
        </Link>
      </p>
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="py-32 text-center px-6">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="text-muted mt-2">{error.message}</p>
    </div>
  ),
  component: CityPage,
});

function CityPage() {
  const { city } = Route.useLoaderData();
  return (
    <div className="bg-white" style={{ color: NAVY }}>
      {/* Hero */}
      <section className="px-6 py-20 lg:py-28" style={{ background: CREAM, borderBottom: `1px solid ${NAVY}` }}>
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs
            items={[
              { label: "Service Areas", to: "/service-areas" },
              { label: city.name },
            ]}
          />
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.28em] mt-8 mb-4"
            style={{ color: ORANGE }}
          >
            {city.code} · {city.region}
          </p>
          <h1 className="font-display text-5xl lg:text-6xl font-bold leading-[1.05] mb-6" style={{ color: NAVY }}>
            NEMT in {city.name}, Florida
          </h1>
          <p className="text-lg max-w-2xl leading-relaxed" style={{ color: `${NAVY}cc` }}>
            {city.intro}
          </p>
          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              to="/request-a-ride"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ background: ORANGE, borderColor: ORANGE, color: NAVY }}
            >
              Request a Ride in {city.name}
            </Link>
            <Link
              to="/contact"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Talk to Dispatch
            </Link>
          </div>
        </div>
      </section>

      {/* Services in this city */}
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: ORANGE }}>
            Services in {city.name}
          </p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-10" style={{ color: NAVY }}>
            Three levels of non-emergency medical transport.
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {city.services.map((s) => (
              <Link
                key={s.slug}
                to={`/services/${s.slug}` as "/services/ambulatory" | "/services/wheelchair" | "/services/stretcher"}
                className="p-8 rounded-[1rem] bg-white border hover:border-accent transition-colors"
                style={{ borderColor: `${NAVY}1f` }}
              >
                <h3 className="font-display font-bold text-xl mb-3" style={{ color: NAVY }}>
                  {s.headline}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                  {s.copy}
                </p>
                <p className="mt-4 font-mono text-xs font-bold uppercase tracking-[0.2em]" style={{ color: ORANGE }}>
                  Learn more →
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Why + Hubs */}
      <section className="px-6 py-20 lg:py-24" style={{ background: CREAM }}>
        <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: ORANGE }}>
              Why {city.name}
            </p>
            <h2 className="font-display font-bold text-3xl mb-6" style={{ color: NAVY }}>
              Why {city.name} chooses My Florida NEMT
            </h2>
            <ul className="space-y-3">
              {city.highlights.map((h) => (
                <li key={h} className="flex gap-3 text-base" style={{ color: `${NAVY}cc` }}>
                  <span className="mt-2 size-2 rounded-full shrink-0" style={{ background: ORANGE }} />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: ORANGE }}>
              Facilities served
            </p>
            <h2 className="font-display font-bold text-3xl mb-6" style={{ color: NAVY }}>
              Hospitals & healthcare hubs
            </h2>
            <ul className="grid grid-cols-1 gap-3">
              {city.hubs.map((h) => (
                <li
                  key={h}
                  className="p-4 rounded-[0.75rem] bg-white border font-mono text-sm font-bold"
                  style={{ borderColor: `${NAVY}1f`, color: NAVY }}
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Neighborhoods */}
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: ORANGE }}>
            Coverage
          </p>
          <h2 className="font-display font-bold text-3xl mb-8" style={{ color: NAVY }}>
            Neighborhoods & nearby areas we cover
          </h2>
          <div className="flex flex-wrap gap-3">
            {city.neighborhoods.map((n) => (
              <span
                key={n}
                className="px-4 py-2 rounded-full border text-sm font-semibold"
                style={{ borderColor: `${NAVY}33`, color: NAVY, background: MINT }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20" style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-6">
            Need transport in {city.name} today?
          </h2>
          <p className="text-white/75 mb-8 max-w-xl mx-auto">
            Statewide dispatch, Medicaid billing handled, on-time pickup guaranteed.
          </p>
          <Link
            to="/request-a-ride"
            className="font-bold px-8 py-4 rounded-[0.875rem] inline-flex items-center gap-2"
            style={{ background: ORANGE, color: NAVY }}
          >
            Book a Ride in {city.name}
          </Link>
        </div>
      </section>
    </div>
  );
}

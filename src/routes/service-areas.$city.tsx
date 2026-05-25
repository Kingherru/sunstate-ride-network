import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { CITIES, type CitySlug } from "@/lib/cities";

export const Route = createFileRoute("/service-areas/$city")({
  loader: ({ params }) => {
    const city = CITIES[params.city as CitySlug];
    if (!city) throw notFound();
    return { city };
  },
  head: ({ loaderData, params }) => {
    const c = loaderData?.city;
    const title = c
      ? `NEMT in ${c.name} — Medical Transport | Florida NEMT Network`
      : "Service Area — Florida NEMT Network";
    const description = c
      ? `Non-emergency medical transportation in ${c.name}, ${c.region}. Ambulatory, wheelchair, and stretcher transport serving ${c.hubs.slice(0, 2).join(" and ")}.`
      : "Florida NEMT coverage detail.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: `/service-areas/${params.city}` },
      ],
      links: [{ rel: "canonical", href: `/service-areas/${params.city}` }],
      scripts: c
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "MedicalBusiness",
                name: `Florida NEMT Network — ${c.name}`,
                description,
                areaServed: { "@type": "City", name: c.name, addressRegion: "FL", addressCountry: "US" },
                telephone: "+1-800-555-0199",
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
    <>
      <section className="py-20 lg:py-28 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            {city.code} · {city.region}
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter mb-6">
            NEMT in {city.name}
          </h1>
          <p className="text-lg text-muted max-w-3xl mb-10">{city.blurb}</p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/request-a-ride"
              className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-wide uppercase hover:translate-y-[-2px] transition-transform"
            >
              Request a Ride in {city.name}
            </Link>
            <a
              href="tel:8005550199"
              className="px-8 py-4 border-2 border-primary/10 text-primary font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-primary/5 transition-colors"
            >
              Call (800) 555-0199
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter mb-6">Why {city.name} chooses us</h2>
            <ul className="space-y-4">
              {city.highlights.map((h: string) => (
                <li key={h} className="flex gap-4 text-base">
                  <span className="mt-2 size-2 rounded-full bg-accent shrink-0" />
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter mb-6">Hospitals & facilities served</h2>
            <ul className="grid grid-cols-1 gap-3">
              {city.hubs.map((h: string) => (
                <li
                  key={h}
                  className="bg-card border border-border p-4 rounded-sm font-mono text-sm font-bold text-primary"
                >
                  {h}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto bg-primary text-primary-foreground rounded-3xl p-12 lg:p-16 text-center">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tighter mb-6">
            Need transport in {city.name} today?
          </h2>
          <Link
            to="/request-a-ride"
            className="inline-block px-10 py-5 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:scale-105 transition-transform"
          >
            Book a Ride
          </Link>
        </div>
      </section>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { CITY_LIST } from "@/lib/cities";

export const Route = createFileRoute("/service-areas/")({
  head: () => ({
    meta: [
      { title: "Florida Service Areas — Statewide NEMT Coverage" },
      {
        name: "description",
        content:
          "My Florida NEMT coverage across Jacksonville, Orlando, Tampa, Miami, Tallahassee, and Fort Lauderdale — plus the corridors in between.",
      },
      { property: "og:title", content: "My Florida NEMT Service Areas" },
      { property: "og:description", content: "Statewide non-emergency medical transport coverage." },
      { property: "og:url", content: "/service-areas" },
    ],
    links: [{ rel: "canonical", href: "/service-areas" }],
  }),
  component: ServiceAreasIndex,
});

function ServiceAreasIndex() {
  return (
    <>
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Statewide Florida Coverage
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter max-w-3xl mb-6">
            One network. Every major Florida hub.
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            My Florida NEMT operates 24/7 dispatch across the state's primary medical corridors.
            Pick your region to see local detail.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CITY_LIST.map((c) => (
            <Link
              key={c.slug}
              to="/service-areas/$city"
              params={{ city: c.slug }}
              className="group bg-card border border-border rounded-xl p-8 hover:border-primary/30 hover:shadow-lg transition-all"
            >
              <div className="flex items-start justify-between mb-8">
                <span className="font-mono text-xs text-muted">{c.code}</span>
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  {c.region}
                </span>
              </div>
              <h2 className="text-3xl font-extrabold tracking-tight mb-3">{c.name}</h2>
              <p className="text-sm text-muted leading-relaxed mb-6">{c.blurb}</p>
              <span className="text-xs font-bold uppercase tracking-widest text-accent group-hover:underline">
                View coverage →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, Network } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SectionHead } from "@/components/public/page-kit";
import { LinkCard, trailHead } from "@/components/public/coverage-kit";
import { citiesInCounty, countyPath, findRegion } from "@/lib/coverage";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/florida-coverage/$region/")({
  loader: ({ params }) => { const r = findRegion(params.region); if (!r) throw notFound(); return r; },
  head: ({ loaderData: r }) => r ? trailHead(`/florida-coverage/${r.slug}`, `${r.name} Florida NEMT — Counties & Medical Rides | MY FLORIDA NEMT`,
    `Non-emergency medical transportation requests in Florida's ${r.name} region: browse the ${r.counties.length} counties and request a trip reviewed by independent providers.`,
    [{ name: "Home", path: "/" }, { name: "Coverage", path: "/florida-coverage" }, { name: r.name, path: `/florida-coverage/${r.slug}` }]) : {},
  component: RegionPage,
});

function RegionPage() {
  const r = Route.useLoaderData();
  const withPages = r.counties.filter((c) => citiesInCounty(c).length);
  const others = r.counties.filter((c) => !citiesInCounty(c).length);
  return (
    <PublicPage>
      <PageHero title={`${r.name} region`} intro={<p>{r.intro}</p>} />
      <section aria-labelledby="counties" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="counties" title={`Counties in the ${r.name} region`} intro="County pages list the cities we currently have pages for. Showing a county does not mean a provider is available there." /></Reveal>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {withPages.map((c, i) => <li key={c}><Reveal delay={i * 50}><LinkCard href={countyPath(c)} title={`${c} County`} text={citiesInCounty(c).map((x) => x.name).join(", ")} /></Reveal></li>)}
          </ul>
          {others.length > 0 && (
            <div className="mx-auto mt-12 max-w-3xl text-center">
              <h3 className="ds-subheading uppercase text-ds-primary">Other counties in this region</h3>
              <p className="ds-body-lg mt-3 text-ds-text-2">{others.map((c) => `${c} County`).join(" · ")}</p>
              <p className="ds-body mt-3 text-ds-text-2">You can still submit a trip request from any of these counties.</p>
            </div>
          )}
        </div>
      </section>
      <CtaBand title={`Need a ride in the ${r.name} region?`} text="Submit a request and participating providers who serve the area can review it." actions={[
        { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
        { label: "Join the Provider Network", to: LINKS.join, icon: Network },
      ]} />
    </PublicPage>
  );
}

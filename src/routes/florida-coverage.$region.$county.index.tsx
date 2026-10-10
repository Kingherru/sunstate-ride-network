import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, Network } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SectionHead } from "@/components/public/page-kit";
import { LinkCard, trailHead } from "@/components/public/coverage-kit";
import { cityPath, citiesInCounty, countyPath, findCounty, findRegion } from "@/lib/coverage";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/florida-coverage/$region/$county/")({
  loader: ({ params }) => {
    const region = findRegion(params.region);
    const county = region && params.county.endsWith("-county") ? findCounty(region, params.county.slice(0, -7)) : undefined;
    if (!region || !county) throw notFound();
    return { region, county, cities: citiesInCounty(county) };
  },
  head: ({ loaderData: d }) => d ? trailHead(countyPath(d.county), `Medical Rides in ${d.county} County, FL — NEMT Requests | MY FLORIDA NEMT`,
    `Request non-emergency medical rides in ${d.county} County, Florida, including ${d.cities.map((c) => c.name).join(", ")}. Independent providers review and accept each trip.`,
    trail(d.region.name, d.region.slug, d.county)) : {},
  component: CountyPage,
});

const trail = (rn: string, rs: string, county: string) => [
  { name: "Home", path: "/" }, { name: "Coverage", path: "/florida-coverage" },
  { name: rn, path: `/florida-coverage/${rs}` }, { name: `${county} County`, path: countyPath(county) },
];

function CountyPage() {
  const { region, county, cities } = Route.useLoaderData();
  return (
    <PublicPage>
      <PageHero title={`${county} County medical rides`} intro={<p>{county} County is part of the {region.name} region. Trip requests from anywhere in the county can be submitted online and are reviewed by participating independent providers.</p>} />
      <section aria-labelledby="cities" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="cities" title={`Cities in ${county} County`} intro="Each city page covers local travel considerations and what to include in your request." /></Reveal>
          <ul className="mx-auto mt-10 grid max-w-4xl gap-5 sm:grid-cols-2">
            {cities.map((c) => <li key={c.slug}><LinkCard href={cityPath(c)} title={c.name} text={c.about[0]} /></li>)}
          </ul>
          <p className="ds-body-lg mx-auto mt-10 max-w-2xl text-center text-ds-text-2">Live elsewhere in {county} County? You can still <a href={LINKS.book} className="text-ds-link underline underline-offset-4">submit a trip request</a> or return to the <a href={`/florida-coverage/${region.slug}`} className="text-ds-link underline underline-offset-4">{region.name} region</a>.</p>
        </div>
      </section>
      <CtaBand title={`Request a ride in ${county} County`} text="Share the trip details so participating providers can review it." actions={[
        { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
        { label: "Join the Provider Network", to: LINKS.join, icon: Network },
      ]} />
    </PublicPage>
  );
}

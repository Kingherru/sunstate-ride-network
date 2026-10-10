import { createFileRoute, notFound } from "@tanstack/react-router";
import { CalendarPlus, Phone, UserPlus } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, NonEmergencyNotice, PageHero, Reveal } from "@/components/public/page-kit";
import { trailHead } from "@/components/public/coverage-kit";
import { CITIES, cityPath, countyPath, findRegion, regionOfCounty, slugify } from "@/lib/coverage";
import { LINKS, PUBLIC_PHONE_TEL } from "@/lib/site-config";

export const Route = createFileRoute("/florida-coverage/$region/$county/$city")({
  loader: ({ params }) => {
    const city = CITIES.find((c) => c.slug === params.city);
    const region = findRegion(params.region);
    if (!city || !region || regionOfCounty(city.county)?.slug !== region.slug || `${slugify(city.county)}-county` !== params.county) throw notFound();
    return { city, region };
  },
  head: ({ loaderData: d }) => d ? trailHead(cityPath(d.city), d.city.title, d.city.description, trail(d.city, d.region.name, d.region.slug)) : {},
  component: CityPage,
});

const trail = (c: (typeof CITIES)[number], rn: string, rs: string) => [
  { name: "Home", path: "/" }, { name: "Coverage", path: "/florida-coverage" }, { name: rn, path: `/florida-coverage/${rs}` },
  { name: `${c.county} County`, path: countyPath(c.county) }, { name: c.name, path: cityPath(c) },
];

const lnk = "text-ds-link underline underline-offset-4";

function CityPage() {
  const { city, region } = Route.useLoaderData();
  return (
    <PublicPage>
      <PageHero title={city.h1} intro={<p>Request non-emergency medical transportation in {city.name}. Participating independent providers review each request — a ride is confirmed only when a provider accepts it.</p>} />
      <section className="mfn-section bg-ds-bg">
        <div className="mfn-container mfn-read mx-auto space-y-10">
          <Reveal>
            <h2 className="ds-section-title uppercase text-ds-primary">About {city.name}</h2>
            {city.about.map((p) => <p key={p} className="ds-body-lg mt-4">{p}</p>)}
          </Reveal>
          <Reveal>
            <h2 className="ds-section-title uppercase text-ds-primary">Medical rides in {city.name}: what to consider</h2>
            <ul className="ds-body-lg mt-4 list-disc space-y-2 pl-6">{city.needs.map((n) => <li key={n}>{n}</li>)}</ul>
          </Reveal>
          {city.landmarks && (
            <Reveal>
              <h2 className="ds-section-title uppercase text-ds-primary">Major medical centers in the area</h2>
              <p className="ds-body-lg mt-4 text-ds-text-2">Listed as local landmarks only. They are not partners of MY FLORIDA NEMT, and listing them does not mean a provider is available for trips there.</p>
              <ul className="ds-body-lg mt-4 list-disc space-y-1 pl-6">{city.landmarks.map((l) => <li key={l}>{l}</li>)}</ul>
            </Reveal>
          )}
          <Reveal>
            <h2 className="ds-section-title uppercase text-ds-primary">Trip types you can request</h2>
            <p className="ds-body-lg mt-4">Requests from {city.name} can be made for <a className={lnk} href="/services/ambulatory">ambulatory rides</a>, <a className={lnk} href="/services/wheelchair">wheelchair transportation</a>, <a className={lnk} href="/services/stretcher">stretcher transportation</a> or <a className={lnk} href="/services/medical-delivery">medical delivery</a>. Not every provider offers every service, and availability depends on the trip and timing. Submit 48–72 hours ahead whenever possible.</p>
          </Reveal>
          <NonEmergencyNotice />
          <p className="ds-body-lg">More in the area: <a className={lnk} href={countyPath(city.county)}>{city.county} County</a> · <a className={lnk} href={`/florida-coverage/${region.slug}`}>{region.name} region</a> · <a className={lnk} href="/florida-coverage">Florida coverage</a></p>
        </div>
      </section>
      <CtaBand title={`Request a trip in ${city.name}`} text="Share the pickup, destination, time and mobility needs so participating providers can review your request." actions={[
        { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
        { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
        { label: "Call Us", to: PUBLIC_PHONE_TEL, icon: Phone },
      ]} />
    </PublicPage>
  );
}

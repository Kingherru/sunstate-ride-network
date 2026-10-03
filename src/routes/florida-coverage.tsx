import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Info, Network, UserPlus } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, pageHead } from "@/components/public/page-kit";
import { FloridaMap } from "@/components/home/FloridaMap";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/florida-coverage")({
  head: () => pageHead(
    "/florida-coverage",
    "Florida NEMT Coverage Map — Explore All 67 Counties | My Florida NEMT",
    "Explore Florida by region, county, city or ZIP code. Provider participation is growing and service availability varies by location and trip needs.",
    "Coverage",
  ),
  component: CoveragePage,
});

const NOTES = [
  "Service varies by location.",
  "Provider participation is still growing.",
  "A highlighted area does not mean a provider is available.",
  "Actual availability depends on the trip, timing, equipment needs and participating providers.",
];

function CoveragePage() {
  return (
    <PublicPage>
      <PageHero
        crumb="Coverage"
        title="Connections across Florida start here"
        intro={<p>MY FLORIDA NEMT is being built around all 67 Florida counties. Use the map to explore by region, county, city or ZIP code — and see where to begin, whether you need a ride or serve an area.</p>}
      />
      <FloridaMap page />

      <section aria-labelledby="avail-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:items-center lg:gap-14">
          <Reveal direction="left">
            <h2 id="avail-title" className="ds-page-title uppercase text-ds-primary">What the map doesn’t tell you</h2>
            <p className="ds-body-lg mt-4 text-ds-text-2">The map shows where the network is being built. Displayed coverage does not guarantee that a provider is available for your trip.</p>
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-2">
            {NOTES.map((n) => <li key={n} className="ds-body-lg flex gap-3 rounded-ds bg-ds-sky p-5"><Info className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{n}</li>)}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Need transportation in your area?"
        text="Submit a request and participating providers who serve your area can review it."
        actions={[
          { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
          { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
          { label: "Join the Provider Network", to: LINKS.join, icon: Network },
        ]}
      />
    </PublicPage>
  );
}

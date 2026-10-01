import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, Info, Network } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { PageHero, btnAction, btnBlue, pageHead } from "@/components/public/page-kit";
import { FloridaMap } from "@/components/home/FloridaMap";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/florida-coverage")({
  head: () => pageHead(
    "/florida-coverage",
    "Florida NEMT Coverage Map — Explore All 67 Counties | My Florida NEMT",
    "Explore Florida by region, county, city or ZIP code. Provider participation is growing and service availability varies by location and trip needs.",
    "Florida Coverage",
  ),
  component: CoveragePage,
});

const NOTES = [
  "Service varies by location.",
  "Provider participation is still growing.",
  "A highlighted area does not guarantee availability.",
  "Actual availability depends on the trip, timing, equipment needs and participating providers.",
];

function CoveragePage() {
  return (
    <PublicPage>
      <PageHero
        crumb="Florida Coverage"
        eyebrow="FLORIDA COVERAGE"
        title="Connections across Florida start here"
        intro={<p>My Florida NEMT is being built around all 67 Florida counties. Use the map to explore by region, county, city or ZIP code — and see where to begin, whether you need a ride or serve an area.</p>}
      />
      <FloridaMap page />

      <section aria-labelledby="avail-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <div>
            <p className="ds-label text-ds-accent-active">About availability</p>
            <h2 id="avail-title" className="ds-page-title mt-2 text-ds-primary">What the map does and doesn’t tell you.</h2>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {NOTES.map((n) => <li key={n} className="ds-body-lg flex gap-3 rounded-ds bg-ds-subtle p-5"><Info className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{n}</li>)}
          </ul>
        </div>
      </section>

      <section aria-label="Next steps" className="mfn-section bg-ds-subtle">
        <div className="mfn-container grid gap-6 md:grid-cols-2">
          <div className="rounded-ds-lg bg-ds-surface p-7 shadow-ds sm:p-9">
            <h2 className="ds-section-title uppercase text-ds-primary">Need transportation?</h2>
            <p className="ds-body-lg mt-3 text-ds-text-2">Share your trip details and participating providers in your area can review the request.</p>
            <a href={LINKS.book} className={`${btnAction} mt-6`}><CalendarPlus aria-hidden />Book a Trip</a>
          </div>
          <div className="rounded-ds-lg bg-ds-surface p-7 shadow-ds sm:p-9">
            <h2 className="ds-section-title uppercase text-ds-primary">Serve this area?</h2>
            <p className="ds-body-lg mt-3 text-ds-text-2">Join the provider network to share trips, review opportunities and help grow coverage where you operate.</p>
            <a href={LINKS.join} className={`${btnBlue} mt-6`}><Network aria-hidden />Join the Provider Network</a>
          </div>
        </div>
      </section>
    </PublicPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, Building2, CalendarClock, CalendarPlus, ClipboardList, Hospital, Home, MapPin, Receipt, Repeat, Stethoscope, UserRound, Users, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, HeroActions, IconItem, NonEmergencyNotice, PageHero, SectionHead, Steps, pageHead } from "@/components/public/page-kit";
import { HOME_IMAGES } from "@/lib/site-config";

export const Route = createFileRoute("/for-facilities")({
  head: () => pageHead(
    "/for-facilities",
    "For Facilities — Coordinate Planned Transportation in Florida | My Florida NEMT",
    "Hospitals, care communities, medical offices and case managers can request one-time or recurring non-emergency trips from participating Florida providers.",
  ),
  component: FacilitiesPage,
});

const WHO = [
  { i: Hospital, t: "Hospitals" }, { i: Building2, t: "Skilled nursing facilities" }, { i: Home, t: "Assisted-living communities" },
  { i: Stethoscope, t: "Rehabilitation centers" }, { i: Home, t: "Group homes" }, { i: Stethoscope, t: "Medical offices" },
  { i: ClipboardList, t: "Case managers" }, { i: Users, t: "Other organizations arranging planned transportation" },
];
const FLOW = [
  { t: "Create or use a facility account." },
  { t: "Enter the trip and passenger requirements." },
  { t: "Request one-time or recurring transportation." },
  { t: "Follow availability and trip status." },
  { t: "Keep authorized team members informed." },
];
const ACCOUNT = [
  "A facility account is designed to have a primary (master) account owner.",
  "Authorized team members will be able to be added.",
  "Your organization can keep trip coordination in one workspace.",
  "Saved recurring trip information will reduce repeated entry.",
  "Access is designed to work on desktop, tablet and mobile.",
];
const READY = [
  { i: UserRound, t: "Passenger or authorized-contact information" },
  { i: MapPin, t: "Pickup and destination" },
  { i: CalendarClock, t: "Appointment or requested arrival time" },
  { i: Accessibility, t: "Mobility equipment and assistance requirements" },
  { i: Repeat, t: "One-way, round-trip or recurring schedule" },
  { i: Workflow, t: "Return-trip expectations" },
  { i: Receipt, t: "Billing or responsible-party information, when applicable" },
];

function FacilitiesPage() {
  return (
    <PublicPage>
      <PageHero
        eyebrow="FOR FACILITIES"
        title="A clearer way to coordinate planned transportation"
        img={HOME_IMAGES.facility}
        intro={<p>Facilities and organizations can use My Florida NEMT to organize planned, non-emergency trip requests and share them with participating independent providers.</p>}
      >
        <HeroActions secondary="how" />
      </PageHero>

      <section aria-labelledby="who-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <SectionHead id="who-title" eyebrow="Who it’s for" title="Built for the teams who arrange rides every day." />
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => <li key={w.t} className="ds-body-lg flex items-center gap-3 rounded-ds bg-ds-subtle p-5"><w.i className="size-6 shrink-0 text-ds-primary" aria-hidden />{w.t}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="mfn-section bg-ds-sky">
        <div className="mfn-container grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div>
            <SectionHead id="flow-title" eyebrow="The facility workflow" title="From request to ride, in five steps." />
            <div className="mt-8"><Steps steps={FLOW} /></div>
          </div>
          <div className="rounded-ds-lg bg-ds-surface p-6 shadow-ds sm:p-8">
            <h2 className="ds-section-title text-ds-primary">Facility accounts</h2>
            <p className="ds-support mt-2">Facility accounts are being prepared. When they are activated:</p>
            <ul className="mt-5 divide-y divide-ds-border">
              {ACCOUNT.map((a) => <li key={a} className="ds-body-lg py-3">{a}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="ready-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-14">
          <div>
            <SectionHead id="ready-title" eyebrow="Be prepared" title="What to have ready" intro="These details help participating providers review a request quickly." />
            <NonEmergencyNotice className="mt-8" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {READY.map((r) => <IconItem key={r.t} icon={r.i}>{r.t}</IconItem>)}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Have a trip to arrange?"
        text="Send the details and participating providers can review availability."
        primary={{ label: "Book a Trip", to: "/book", icon: CalendarPlus }}
        secondary={{ label: "How It Works", to: "/how-it-works", icon: Workflow }}
      />
    </PublicPage>
  );
}

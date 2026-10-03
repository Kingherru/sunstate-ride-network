import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, BedSingle, Building2, CalendarClock, CalendarPlus, ClipboardList, Footprints, Home, Hospital, MapPin, Package, Phone, Receipt, Repeat, Stethoscope, UserPlus, UserRound, Users, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, IconItem, NonEmergencyNotice, PageHero, Reveal, SectionHead, Steps, pageHead } from "@/components/public/page-kit";
import { HOME_IMAGES, LINKS, PUBLIC_PHONE_TEL } from "@/lib/site-config";

export const Route = createFileRoute("/for-facilities")({
  head: () => pageHead(
    "/for-facilities",
    "Transportation for Patients and Facilities in Florida | MY FLORIDA NEMT",
    "Patients, private-pay customers, facilities and hospitals can request one-time or recurring Florida non-emergency medical transportation from participating independent providers.",
    "Patients and Facilities",
  ),
  component: FacilitiesPage,
});

const WHO = [
  { i: UserRound, t: "Patients and private-pay customers" }, { i: Users, t: "Family members and caregivers" },
  { i: Hospital, t: "Hospitals and discharge teams" }, { i: Building2, t: "Skilled nursing and assisted living" },
  { i: Stethoscope, t: "Medical offices and rehab centers" }, { i: Home, t: "Group homes" },
  { i: ClipboardList, t: "Case managers" }, { i: Users, t: "Other organizations arranging rides" },
];
const NEEDS = [
  { i: Footprints, t: "Ambulatory rides", h: "/services#ambulatory" },
  { i: Accessibility, t: "Wheelchair transportation", h: "/services#wheelchair" },
  { i: BedSingle, t: "Stretcher or specialized", h: "/services#stretcher" },
  { i: Package, t: "Medical delivery", h: "/services#delivery" },
];
const FLOW = [
  { t: "Create an account.", d: "Choose Private Pay, Facility or Hospital. Each person uses their own email." },
  { t: "Submit the trip request.", d: "One-time, round-trip or recurring rides for one or more passengers." },
  { t: "Participating providers review it.", d: "Availability depends on an independent provider accepting the request." },
  { t: "Get confirmation.", d: "Provider details are shared once the trip is accepted." },
  { t: "Track and repeat.", d: "Facilities can keep recurring rides organized in one account." },
];
const READY = [
  { i: UserRound, t: "Passenger or authorized-contact information" },
  { i: MapPin, t: "Pickup and destination" },
  { i: CalendarClock, t: "Appointment or requested arrival time" },
  { i: Accessibility, t: "Mobility equipment and assistance needs" },
  { i: Repeat, t: "One-way, round-trip or recurring schedule" },
  { i: Workflow, t: "Return-trip expectations" },
  { i: Receipt, t: "Billing or responsible-party information, when applicable" },
];
const BENEFITS = [
  "Request rides without re-entering the same details",
  "Coordinate recurring or multiple rides in one place",
  "Each authorized team member signs in with their own email",
  "Works on desktop, tablet and phone",
];

function FacilitiesPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="Patients and Facilities"
        title="Transportation for patients and facilities"
        img={HOME_IMAGES.facility}
        intro={<p>For individual patients, private-pay customers, facilities and hospitals that need planned, non-emergency transportation in Florida. Submit a request and participating independent providers can review it.</p>}
      />

      <section aria-labelledby="who-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="who-title" title="Who this is for" intro="Anyone arranging planned rides — for themselves, a loved one or the people they care for every day." /></Reveal>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHO.map((w) => <li key={w.t} className="ds-body-lg flex items-center gap-3 rounded-ds bg-ds-sky p-5"><w.i className="size-6 shrink-0 text-ds-primary" aria-hidden />{w.t}</li>)}
          </ul>
          <h2 className="ds-page-title mt-16 text-center uppercase text-ds-primary">Transportation needs supported</h2>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {NEEDS.map((n) => <li key={n.t}><a href={n.h} className="ds-body-lg flex h-full items-center gap-3 rounded-ds bg-ds-primary p-5 text-ds-on-primary ds-transition hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus"><n.i className="size-6 shrink-0 text-ds-accent" aria-hidden />{n.t}</a></li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="flow-title" className="mfn-section bg-ds-sky">
        <div className="mfn-container grid gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal direction="left">
            <SectionHead align="left" id="flow-title" title="How requesting a trip works" />
            <div className="mt-8"><Steps steps={FLOW} /></div>
          </Reveal>
          <Reveal direction="right">
            <div className="rounded-ds-lg bg-ds-surface p-6 shadow-ds sm:p-8">
              <h2 className="ds-section-title uppercase text-ds-primary">Account benefits</h2>
              <ul className="mt-5 divide-y divide-ds-border">
                {BENEFITS.map((a) => <li key={a} className="ds-body-lg py-3">{a}</li>)}
              </ul>
              <p className="ds-support mt-4">Facility and hospital accounts start as pending while setup is completed. Team-member tools are being prepared.</p>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="ready-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:items-center lg:gap-14">
          <div>
            <SectionHead align="left" id="ready-title" title="What information to prepare" intro="These details help participating providers review a request quickly." />
            <NonEmergencyNotice className="mt-8" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {READY.map((r) => <IconItem key={r.t} icon={r.i}>{r.t}</IconItem>)}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Ready to arrange a ride?"
        text="Submit a request or create an account. Availability depends on an independent provider accepting the request."
        actions={[
          { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
          { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
          { label: "Call Us", to: PUBLIC_PHONE_TEL, icon: Phone },
        ]}
      />
    </PublicPage>
  );
}

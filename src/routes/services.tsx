import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, ArrowRight, BedSingle, CalendarClock, CalendarPlus, DoorOpen, Footprints, MapPin, Package, Phone, Repeat, UserPlus, UserRound, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, IconItem, NonEmergencyNotice, PageHero, Reveal, SectionHead, pageHead } from "@/components/public/page-kit";
import { HOME_IMAGES, LINKS, PUBLIC_PHONE_TEL } from "@/lib/site-config";

export const Route = createFileRoute("/services")({
  head: () => pageHead(
    "/services",
    "Florida NEMT Services — Medical Rides, Wheelchair, Stretcher & Medical Delivery",
    "Florida non-emergency medical transportation: request ambulatory, wheelchair, stretcher or medical-delivery trips from participating independent NEMT providers.",
    "Services",
  ),
  component: ServicesPage,
});

const SERVICES = [
  { id: "ambulatory", n: "Ambulatory transportation", icon: Footprints,
    d: "Florida medical rides for people who can walk on their own or with a little help — appointments, therapy, dialysis and outpatient visits. Tell providers whether the rider uses a cane or walker and needs door-to-door help." },
  { id: "wheelchair", n: "Wheelchair transportation", icon: Accessibility,
    d: "Ramp- or lift-equipped vehicles for riders who travel seated in a wheelchair. Include whether it is manual or power, its approximate size and any transfer or securement needs." },
  { id: "stretcher", n: "Stretcher or specialized transportation", icon: BedSingle,
    d: "Planned, non-emergency trips for riders who need to lie flat or need extra positioning support. Mention stairs, narrow entrances, attendants and equipment traveling with the rider." },
  { id: "delivery", n: "Medical delivery", icon: Package,
    d: "Florida medical delivery for time-sensitive supplies, specimens, equipment or paperwork. Share pickup and drop-off contacts, handling or temperature needs and the deadline." },
];

const CHECKLIST = [
  { icon: MapPin, t: "Pickup and destination addresses" },
  { icon: CalendarClock, t: "Appointment or requested arrival time" },
  { icon: Repeat, t: "One-way, round-trip or recurring" },
  { icon: Accessibility, t: "Mobility equipment and assistance needs" },
  { icon: DoorOpen, t: "Stairs, entrances or transfer considerations" },
  { icon: Phone, t: "An authorized contact and phone number" },
  { icon: UserRound, t: "Return-trip or wait-time expectations" },
  { icon: Workflow, t: "Anything a provider should know in advance" },
];

function ServicesPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="Services"
        title="Florida NEMT services"
        img={HOME_IMAGES.stretcher}
        intro={<p>Request planned non-emergency medical transportation or medical delivery anywhere in Florida. Each trip is reviewed and completed by a participating independent provider — availability and pricing depend on the provider and location.</p>}
      />

      <section aria-labelledby="types-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="types-title" title="Four kinds of trips" intro="Choose the service that fits the rider or delivery, then share the details in your request." /></Reveal>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {SERVICES.map((s, i) => (
              <Reveal key={s.id} delay={i * 80}>
                <a id={s.id} href={`${LINKS.book}?service=${s.id}`} className="group flex h-full scroll-mt-24 flex-col rounded-ds bg-ds-sky p-6 ds-transition hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus sm:p-8">
                  <span className="flex items-center gap-4">
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-ds-sm bg-ds-primary text-ds-on-primary"><s.icon className="size-6" aria-hidden /></span>
                    <h3 className="ds-section-title uppercase text-ds-primary">{s.n}</h3>
                  </span>
                  <p className="ds-body-lg mt-4 flex-1 text-ds-on-surface">{s.d}</p>
                  <span className="ds-button-text mt-5 inline-flex items-center gap-2 uppercase text-ds-link">Request this service <ArrowRight className="size-4 ds-transition group-hover:translate-x-1" aria-hidden /></span>
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="who-title" className="mfn-section bg-ds-primary text-ds-on-primary">
        <Reveal className="mfn-container">
          <SectionHead onBlue id="who-title" title="Who can request a trip" intro={<span className="opacity-90">Patients, private-pay customers, family members and caregivers, facilities, hospitals and case managers. Submitting a request does not guarantee a ride — a participating provider must review and accept it.</span>} />
        </Reveal>
      </section>

      <section aria-labelledby="before-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:items-center lg:gap-14">
          <Reveal direction="left">
            <SectionHead align="left" id="before-title" title="Before you request" intro="Having these details ready helps providers review your request quickly and accurately." />
            <NonEmergencyNotice className="mt-8" />
          </Reveal>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CHECKLIST.map((c) => <IconItem key={c.t} icon={c.icon}>{c.t}</IconItem>)}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Ready to request transportation?"
        text="Share the trip details and participating Florida providers can review the request."
        actions={[
          { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
          { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
          { label: "Call Us", to: PUBLIC_PHONE_TEL, icon: Phone },
        ]}
      />
    </PublicPage>
  );
}

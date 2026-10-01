import { createFileRoute } from "@tanstack/react-router";
import { Accessibility, BedSingle, CalendarClock, CalendarPlus, Footprints, MapPin, Package, Phone, Repeat, UserRound, DoorOpen, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, HeroActions, IconItem, NonEmergencyNotice, PageHero, SectionHead, pageHead } from "@/components/public/page-kit";
import { HOME_IMAGES } from "@/lib/site-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/services")({
  head: () => pageHead(
    "/services",
    "NEMT Services in Florida — Ambulatory, Wheelchair, Stretcher & Delivery | My Florida NEMT",
    "Request ambulatory, wheelchair, stretcher or medical-delivery transportation from participating independent Florida providers. Availability varies by provider and location.",
    "Services",
  ),
  component: ServicesPage,
});

const SERVICES = [
  { id: "ambulatory", n: "Ambulatory transportation", icon: Footprints, tone: "bg-ds-sky",
    who: "Riders who can walk on their own or with a little help — for example to medical appointments, therapy, dialysis or outpatient visits.",
    info: "Pickup and destination, appointment time, and whether the rider needs door-to-door help, a walker or a cane." },
  { id: "wheelchair", n: "Wheelchair transportation", icon: Accessibility, tone: "bg-ds-green",
    who: "Riders who travel seated in a wheelchair and need a ramp- or lift-equipped vehicle.",
    info: "Whether the rider uses a manual or power wheelchair, its approximate size and weight, and any transfer or securement needs." },
  { id: "stretcher", n: "Stretcher or specialized transportation", icon: BedSingle, tone: "bg-ds-sand",
    who: "Riders who need to lie flat or need extra positioning support during a planned, non-emergency trip.",
    info: "Positioning needs, stairs or narrow entrances at either end, how many attendants may be needed, and any equipment traveling with the rider." },
  { id: "delivery", n: "Medical delivery and healthcare-related delivery", icon: Package, tone: "bg-ds-peach",
    who: "Facilities, offices and organizations that need time-sensitive pickups or drop-offs of medical items, supplies or paperwork.",
    info: "What is being delivered, pickup and drop-off contacts, handling or temperature requirements, and the deadline." },
];

const CHECKLIST = [
  { icon: MapPin, t: "Pickup and destination addresses" },
  { icon: CalendarClock, t: "Appointment or requested arrival time" },
  { icon: Repeat, t: "One-way or round-trip" },
  { icon: Accessibility, t: "Mobility and assistance needs" },
  { icon: Workflow, t: "Wheelchair type, size or accessibility needs, when applicable" },
  { icon: DoorOpen, t: "Stairs, entrances or transfer considerations" },
  { icon: Phone, t: "An authorized contact and phone number" },
  { icon: UserRound, t: "Return-trip or wait-time expectations" },
];

function ServicesPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="Services"
        eyebrow="SERVICES"
        title="Transportation support for different needs"
        img={HOME_IMAGES.stretcher}
        intro={<>
          <p>Customers, families, facilities and organizations can request planned transportation through My Florida NEMT.</p>
          <p className="opacity-90">Trips are carried out by participating independent providers. Availability, equipment, service type and final pricing depend on the provider and the location.</p>
        </>}
      >
        <HeroActions secondary="how" />
      </PageHero>

      <section aria-labelledby="types-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <SectionHead id="types-title" eyebrow="Service types" title="Four ways participating providers can help." intro="Not every service is available in every area. Tell us what the trip needs and the request is shared with providers who may be able to help." />
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {SERVICES.map((s) => (
              <article key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-24 rounded-ds bg-ds-subtle p-6 sm:p-8">
                <span className={cn("flex size-14 items-center justify-center rounded-ds-sm text-ds-primary", s.tone)}><s.icon className="size-8" aria-hidden /></span>
                <h3 id={`${s.id}-t`} className="ds-section-title mt-5 text-ds-primary">{s.n}</h3>
                <h4 className="ds-label mt-5 text-ds-accent-active">Who it may help</h4>
                <p className="ds-body-lg mt-1">{s.who}</p>
                <h4 className="ds-label mt-4 text-ds-accent-active">What to include in your request</h4>
                <p className="ds-body-lg mt-1">{s.info}</p>
              </article>
            ))}
          </div>
          <p className="ds-body-lg mfn-read mt-8 text-ds-text-2">My Florida NEMT does not own every vehicle or employ every driver. Each trip is completed by the participating provider who accepts it.</p>
        </div>
      </section>

      <section aria-labelledby="before-title" className="mfn-section bg-ds-sky">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-14">
          <div>
          <SectionHead align="left" id="before-title" eyebrow="Get ready" title="Before you request a trip" intro="Having these details ready helps providers review your request quickly and accurately." />
            <NonEmergencyNotice className="mt-8" />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {CHECKLIST.map((c) => <IconItem key={c.t} icon={c.icon}>{c.t}</IconItem>)}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Ready to request transportation?"
        text="Share the trip details and participating providers can review the request."
        primary={{ label: "Book a Trip", to: "/book", icon: CalendarPlus }}
        secondary={{ label: "How It Works", to: "/how-it-works", icon: Workflow }}
      />
    </PublicPage>
  );
}

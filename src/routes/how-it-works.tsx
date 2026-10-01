import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, CalendarPlus, Check, Minus, Network, Truck, Users } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, HeroActions, PageHero, SectionHead, Steps, pageHead } from "@/components/public/page-kit";

export const Route = createFileRoute("/how-it-works")({
  head: () => pageHead(
    "/how-it-works",
    "How My Florida NEMT Works — Trip Requests & Provider-to-Provider Connections",
    "See the two ways to connect through My Florida NEMT: customers and facilities requesting trips from providers, and providers sharing trips with other providers.",
    "How It Works",
  ),
  component: HowPage,
});

const PATH_A = [
  { t: "Submit the trip details.", d: "Pickup, destination, timing and mobility needs." },
  { t: "The request is shared through the network.", d: "Based on the trip’s needs and location." },
  { t: "A participating provider reviews it.", d: "They check availability and trip requirements." },
  { t: "You receive confirmation.", d: "Provider details are shared when the trip is accepted." },
  { t: "The trip is completed.", d: "By the participating transportation provider." },
];
const PATH_B = [
  { t: "A provider shares a trip it needs covered.", d: "Posted to the network with the key details." },
  { t: "Qualified providers see the opportunity.", d: "Other participating providers can review it." },
  { t: "Details and terms are reviewed.", d: "Providers check trip details and applicable terms." },
  { t: "A receiving provider accepts.", d: "The trip moves to that provider." },
  { t: "Both follow it through completion.", d: "Using the network’s trip tools." },
];

const DOES = [
  "Helps people and organizations request planned transportation",
  "Helps providers connect with other providers",
  "Supports trip communication and organization",
  "Provides network tools on desktop, tablet and mobile",
  "Supports a growing statewide network",
];
const NOT = [
  "Not an emergency transportation service",
  "Not a guarantee that every request will be accepted",
  "Not a replacement for a provider’s licensing, insurance or compliance responsibilities",
  "Not a claim that My Florida NEMT directly operates every trip shown in the network",
];

const FAQ = [
  { q: "Who can request a trip?", a: "Riders, family members, caregivers, facilities and organizations can request planned, non-emergency transportation." },
  { q: "Can facilities use the network?", a: "Yes. Hospitals, care communities, medical offices and case managers can request trips. Facility accounts for teams are being prepared." },
  { q: "Can providers share trips with other providers?", a: "Yes. Provider-to-provider sharing is a core part of the network: a provider can offer a trip it can’t cover, and another participating provider can accept it." },
  { q: "Is service available in every Florida county?", a: "Not yet guaranteed. The network is built around all 67 counties, but participation is still growing and availability depends on the trip, timing, equipment and participating providers." },
  { q: "Is My Florida NEMT an emergency service?", a: "No. It is for planned, non-emergency transportation. For a medical emergency, call 911." },
  { q: "Can the network be used from a phone or tablet?", a: "Yes. Requests and provider tools are designed to work on desktop, tablet and mobile." },
];

function PathCard({ id, icon: Icon, label, title, steps, tone, step }: { id: string; icon: typeof Users; label: string; title: string; steps: typeof PATH_A; tone: string; step: string }) {
  return (
    <section aria-labelledby={id} className={`rounded-ds-lg p-6 sm:p-9 ${tone}`}>
      <p className="ds-label flex items-center gap-2 text-ds-primary"><Icon className="size-5" aria-hidden />{label}</p>
      <h2 id={id} className="ds-section-title mt-2 text-ds-primary">{title}</h2>
      <div className="mt-7"><Steps steps={steps} tone={step} /></div>
    </section>
  );
}

function HowPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="How It Works"
        eyebrow="HOW IT WORKS"
        title="One network. Two ways to connect."
        intro={<p>My Florida NEMT gives customers and facilities a public way to request planned transportation — and gives independent providers a way to connect and share trips with each other. Both paths matter equally.</p>}
      >
        <HeroActions secondary="join" />
      </PageHero>

      <div className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-6 lg:grid-cols-2">
          <PathCard id="path-a" icon={Users} label="Path A · Customers & facilities → providers" title="Request planned transportation" steps={PATH_A} tone="bg-ds-sky" step="bg-ds-primary text-ds-on-primary" />
          <PathCard id="path-b" icon={ArrowLeftRight} label="Path B · Provider ↔ provider" title="Share and accept trips between providers" steps={PATH_B} tone="bg-ds-peach" step="bg-ds-action text-ds-on-action" />
        </div>
        <div className="mfn-container mt-6 grid gap-4 md:grid-cols-2">
          <p className="ds-body-lg rounded-ds bg-ds-subtle p-5">Submitting a request does not guarantee acceptance or availability.</p>
          <p className="ds-body-lg rounded-ds bg-ds-subtle p-5">Participating providers remain independent businesses, responsible for their own licensing, insurance, vehicles, staff, compliance and service decisions.</p>
        </div>
      </div>

      <section aria-labelledby="role-title" className="mfn-section bg-ds-primary text-ds-on-primary">
        <div className="mfn-container">
          <SectionHead onBlue id="role-title" eyebrow="Our role" title="What My Florida NEMT does — and what it isn’t." />
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <div className="rounded-ds bg-ds-primary-hover p-6 sm:p-8">
              <h3 className="ds-subheading flex items-center gap-2"><Network className="size-5 text-ds-accent" aria-hidden />What we do</h3>
              <ul className="mt-4 space-y-3">{DOES.map((d) => <li key={d} className="ds-body-lg flex gap-3"><Check className="mt-1 size-5 shrink-0 text-ds-accent" aria-hidden />{d}</li>)}</ul>
            </div>
            <div className="rounded-ds bg-ds-primary-hover p-6 sm:p-8">
              <h3 className="ds-subheading flex items-center gap-2"><Truck className="size-5 text-ds-accent" aria-hidden />What we are not</h3>
              <ul className="mt-4 space-y-3">{NOT.map((d) => <li key={d} className="ds-body-lg flex gap-3"><Minus className="mt-1 size-5 shrink-0 text-ds-accent" aria-hidden />{d}</li>)}</ul>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_2fr] lg:gap-14">
          <SectionHead align="left" id="faq-title" eyebrow="FAQ" title="Common questions" />
          <div className="divide-y divide-ds-border">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-2">
                <summary className="ds-subheading flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-ds-sm text-ds-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
                  <h3>{f.q}</h3><span aria-hidden className="text-2xl text-ds-accent-active group-open:rotate-45 ds-transition">+</span>
                </summary>
                <p className="ds-body-lg mfn-read pb-4 text-ds-text-2">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Start with the path that fits you."
        text="Request a planned trip, or join the provider network to share and accept trips."
        primary={{ label: "Book a Trip", to: "/book", icon: CalendarPlus }}
        secondary={{ label: "Join the Provider Network", to: "/join", icon: Network }}
      />
    </PublicPage>
  );
}

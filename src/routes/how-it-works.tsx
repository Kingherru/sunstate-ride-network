import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeftRight, ArrowRight, CalendarPlus, Check, Minus, Network, UserPlus, Users } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, Reveal, SectionHead, Steps, pageHead } from "@/components/public/page-kit";
import { LINKS } from "@/lib/site-config";
import { FAQ_ITEMS } from "@/lib/faq";

export const Route = createFileRoute("/how-it-works")({
  head: () => pageHead(
    "/how-it-works",
    "How MY FLORIDA NEMT Works — Trip Requests & NEMT Provider Network",
    "How Florida NEMT trip requests and provider-to-provider connections work: create an account, submit a request, and how independent NEMT providers share trips.",
    "How It Works",
  ),
  component: HowPage,
});

const PATH_A = [
  { t: "Create an account or request as a guest.", d: "Patients, private-pay customers, caregivers, facilities and hospitals can all request trips." },
  { t: "Submit the trip request.", d: "Pickup, destination, date and time, mobility needs and an authorized contact." },
  { t: "Participating providers review it.", d: "They check availability, equipment and trip requirements." },
  { t: "A provider accepts — or it isn’t covered.", d: "A request is not confirmed until an independent provider accepts it." },
  { t: "The provider completes the trip.", d: "Provider details are shared once the trip is accepted." },
];
const PATH_B = [
  { t: "Join the provider network.", d: "Create a provider account and complete your business details." },
  { t: "Receive and review opportunities.", d: "See trip requests and shared trips that fit your area and equipment." },
  { t: "Share trips you can’t cover.", d: "Offer them to other participating providers instead of turning riders away." },
  { t: "Connect business to business.", d: "Work provider to provider or contractor to contractor when extra support is needed." },
  { t: "Follow trips through completion.", d: "Using the network’s trip tools on desktop, tablet or phone." },
];
const IS = ["A peer-to-peer NEMT provider network", "A public booking connection for patients, customers and facilities", "Trip organization and communication tools"];
const ISNT = ["Not an emergency service — call 911 for emergencies", "Not a transportation broker or traditional dispatch company", "Not an unrestricted marketplace", "Not the operator of every trip in the network"];

function Path({ id, icon: Icon, title, steps, tone, cta }: { id: string; icon: typeof Users; title: string; steps: typeof PATH_A; tone: string; cta: { href: string; label: string } }) {
  return (
    <section aria-labelledby={id} className={`flex h-full flex-col rounded-ds-lg p-6 sm:p-9 ${tone}`}>
      <h2 id={id} className="ds-section-title flex items-center gap-3 uppercase text-ds-primary"><Icon className="size-7 shrink-0" aria-hidden />{title}</h2>
      <div className="mt-7 flex-1"><Steps steps={steps} /></div>
      <a href={cta.href} className="ds-button-text mt-7 inline-flex items-center gap-2 uppercase text-ds-link hover:underline underline-offset-4">{cta.label}<ArrowRight className="size-4" aria-hidden /></a>
    </section>
  );
}

function HowPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="How It Works"
        title="How the network works"
        intro={<p>Two ways to connect: customers and facilities request planned transportation from participating providers, and providers share trips with one another.</p>}
      />

      <div className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-6 lg:grid-cols-2">
          <Reveal direction="left"><Path id="path-a" icon={Users} title="For customers and facilities" steps={PATH_A} tone="bg-ds-sky" cta={{ href: "/for-facilities", label: "Patients and facilities" }} /></Reveal>
          <Reveal direction="right"><Path id="path-b" icon={ArrowLeftRight} title="For NEMT providers" steps={PATH_B} tone="bg-ds-membership" cta={{ href: "/for-providers", label: "Providers page" }} /></Reveal>
        </div>
        <p className="ds-body-lg mfn-container mx-auto mt-8 max-w-3xl text-center text-ds-text-2">Submitting a request does not guarantee acceptance or availability. Participating providers remain independent businesses responsible for their own licensing, insurance, vehicles and operations.</p>
      </div>

      <section aria-labelledby="role-title" className="mfn-section bg-ds-primary text-ds-on-primary">
        <div className="mfn-container">
          <Reveal><SectionHead onBlue id="role-title" title="What MY FLORIDA NEMT is — and isn’t" intro={<span className="opacity-90">A peer-to-peer provider network with a public booking connection.</span>} /></Reveal>
          <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-2">
            <ul className="space-y-3 rounded-ds bg-ds-primary-hover p-6 sm:p-8">{IS.map((d) => <li key={d} className="ds-body-lg flex gap-3"><Check className="mt-1 size-5 shrink-0 text-ds-accent" aria-hidden />{d}</li>)}</ul>
            <ul className="space-y-3 rounded-ds bg-ds-primary-hover p-6 sm:p-8">{ISNT.map((d) => <li key={d} className="ds-body-lg flex gap-3"><Minus className="mt-1 size-5 shrink-0 text-ds-accent" aria-hidden />{d}</li>)}</ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container mx-auto max-w-3xl">
          <Reveal><SectionHead id="faq-title" title="People also ask" /></Reveal>
          <div className="mt-8 divide-y divide-ds-border">
            {FAQ_ITEMS.slice(0, 4).map((f) => (
              <div key={f.q} className="py-5">
                <h3 className="ds-subheading text-ds-primary">{f.q}</h3>
                <p className="ds-body-lg mt-2 text-ds-text-2">{f.a}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center"><a href={LINKS.faq} className="ds-button-text inline-flex items-center gap-2 uppercase text-ds-link hover:underline underline-offset-4">See all questions<ArrowRight className="size-4" aria-hidden /></a></p>
        </div>
      </section>

      <CtaBand
        title="Start with the path that fits you"
        text="Request a planned trip, or join the provider network to share and accept trips."
        actions={[
          { label: "Submit Trip Request", to: LINKS.book, icon: CalendarPlus },
          { label: "Create an Account", to: LINKS.createAccount, icon: UserPlus },
          { label: "Join the Provider Network", to: LINKS.join, icon: Network },
        ]}
      />
    </PublicPage>
  );
}

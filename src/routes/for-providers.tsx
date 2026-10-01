import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeftRight, BadgePercent, Briefcase, CalendarX, CreditCard, GraduationCap, LayoutGrid, Monitor, Network, ShieldCheck, Smartphone, Tablet, Truck } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { CtaBand, PageHero, SectionHead, btnAction, btnBlue, btnOnBlue, pageHead } from "@/components/public/page-kit";
import { ProductDemo } from "@/components/home/ProductDemo";
import { HOME_IMAGES, LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/for-providers")({
  head: () => pageHead(
    "/for-providers",
    "For Florida NEMT Providers — Peer-to-Peer Network & Membership | My Florida NEMT",
    "Connect with other Florida NEMT providers, share trips you need covered and review network opportunities. 30 days free, then $10/month plus a 2% platform fee on network trips.",
    "For Providers",
  ),
  component: ProvidersPage,
});

const INDEPENDENCE = [
  "Providers remain independent businesses.",
  "Providers make their own acceptance and operational decisions.",
  "Providers remain responsible for licensing, insurance, vehicles, drivers and legal compliance.",
  "Participation does not guarantee a specific number of trips or revenue.",
];

function ProvidersPage() {
  return (
    <PublicPage>
      <PageHero
        crumb="For Providers"
        eyebrow="FOR PROVIDERS"
        title="A peer-to-peer network for Florida NEMT providers"
        img={HOME_IMAGES.provider}
        intro={<>
          <p>Connect with other providers, share trips you need help covering and review opportunities from across the network.</p>
          <p className="opacity-90">Built to work from the office or on the road — and much more than a public booking form.</p>
        </>}
      >
        <a href={LINKS.join} className={btnAction}><Network aria-hidden />Join the Provider Network</a>
        <Link to="/shop" className={btnOnBlue}><GraduationCap aria-hidden />Explore Training</Link>
      </PageHero>

      <section aria-labelledby="p2p-title" className="mfn-section bg-ds-subtle">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
          <SectionHead align="left" id="p2p-title" eyebrow="The provider-to-provider model" title="When you can’t cover a trip, another provider might." intro="Share a trip you can’t take, or pick up one a fellow provider needs covered. Both sides review the details and terms before anything is accepted." />
          <figure className="rounded-ds-lg bg-ds-surface p-6 shadow-ds sm:p-8">
            <figcaption className="ds-label text-center text-ds-primary">PROVIDER ↔ PROVIDER</figcaption>
            <div className="mt-6 flex items-center" role="img" aria-label="Two providers connected in both directions">
              {[0, 1].map((i) => (
                <div key={i} className={`flex flex-1 flex-col items-center gap-2 rounded-ds bg-ds-peach px-3 py-6 text-center ${i ? "order-3" : ""}`}>
                  <Truck className="size-9 text-ds-primary" aria-hidden />
                  <span className="ds-subheading text-ds-primary">Provider</span>
                  <span className="ds-support">{i ? "Reviews & accepts" : "Shares a trip"}</span>
                </div>
              ))}
              <div aria-hidden className="order-2 flex w-16 shrink-0 items-center justify-center sm:w-24"><ArrowLeftRight className="size-8 text-ds-primary" /></div>
            </div>
          </figure>
        </div>
      </section>

      <ProductDemo />

      <section aria-labelledby="road-title" className="mfn-section bg-ds-sky">
        <div className="mfn-container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <SectionHead align="left" id="road-title" eyebrow="Mobile access" title="Built for the road, not just the office." intro="The whole provider experience — trip opportunities, sharing, Smart Notes, schedules, status and messages — is designed to work on a desktop at the office, a tablet in the van or a phone between trips. Features will be introduced and expanded as the network grows." />
          <ul className="grid grid-cols-3 gap-4">
            {[{ i: Monitor, t: "Desktop" }, { i: Tablet, t: "Tablet" }, { i: Smartphone, t: "Mobile" }].map(({ i: I, t }) => (
              <li key={t} className="flex flex-col items-center gap-3 rounded-ds bg-ds-surface px-3 py-8 shadow-ds">
                <I className="size-12 text-ds-primary" aria-hidden /><span className="ds-subheading text-ds-primary">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="ind-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <SectionHead align="left" id="ind-title" eyebrow="Provider independence" title="Your business stays yours." />
          <ul className="grid gap-3 sm:grid-cols-2">
            {INDEPENDENCE.map((t) => <li key={t} className="ds-body-lg flex gap-3 rounded-ds bg-ds-subtle p-5"><ShieldCheck className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>

      <section id="membership" aria-labelledby="member-title" className="mfn-section scroll-mt-24 bg-ds-primary text-ds-on-primary">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div>
            <p className="ds-label flex items-center gap-2 text-ds-accent"><Network className="size-5" aria-hidden />Provider membership</p>
            <h2 id="member-title" className="mt-4 font-heading text-6xl font-bold uppercase leading-none sm:text-7xl">30 days <span className="text-ds-accent">free</span></h2>
            <p className="ds-section-title mt-5">Then $10 per month. Cancel anytime.</p>
            <p className="ds-body-lg mfn-read mt-4 opacity-90">Membership gives you access to the provider network and its core tools — sharing trips, reviewing opportunities and following trips to completion.</p>
            <div className="mt-7"><a href={LINKS.join} className={btnAction}><Network aria-hidden />Join the Provider Network</a></div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { i: LayoutGrid, t: "30 days free, then $10 per month" },
              { i: BadgePercent, t: "2% My Florida NEMT platform fee on completed trips received through the provider network" },
              { i: CreditCard, t: "Payment-processing fees may apply" },
              { i: CalendarX, t: "No long-term contract — cancel anytime" },
            ].map(({ i: I, t }) => <li key={t} className="ds-body-lg flex gap-3 rounded-ds-sm bg-ds-primary-hover p-5"><I className="mt-0.5 size-6 shrink-0 text-ds-accent" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="train-title" className="mfn-section bg-ds-subtle">
        <div className="mfn-container grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center lg:gap-14">
          <SectionHead align="left" id="train-title" eyebrow="Training" title="Keep building your NEMT knowledge." intro="Providers can also use the Training Shop. Classes are $50 per class and are purchased separately from network membership." />
          <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
            <Link to="/shop" className={btnBlue}><GraduationCap aria-hidden />Explore Training</Link>
          </div>
        </div>
      </section>

      <CtaBand
        title="Bring your business into the network."
        text="Start with 30 days free and see how provider-to-provider sharing fits your operation."
        primary={{ label: "Join the Provider Network", to: "/join", icon: Briefcase }}
        secondary={{ label: "Explore Training", to: "/shop", icon: GraduationCap }}
      />
    </PublicPage>
  );
}

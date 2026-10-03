import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users2, ArrowLeftRight, BadgePercent, Briefcase, CalendarX, CreditCard, GraduationCap, LayoutGrid, Monitor, Network, ShieldCheck, Smartphone, Tablet, Truck } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { PageHero, Reveal, SectionHead, btnAction, btnBlue, btnOnBlue, pageHead } from "@/components/public/page-kit";
import { ProductDemo } from "@/components/home/ProductDemo";
import { HOME_IMAGES, LINKS, TRAINING } from "@/lib/site-config";

export const Route = createFileRoute("/for-providers")({
  head: () => pageHead(
    "/for-providers",
    "Florida NEMT Provider Network — Partners, Contractors & Trip Sharing | MY FLORIDA NEMT",
    "Join a peer-to-peer Florida NEMT provider network: share trips, connect business to business, manage NEMT team members and contractors. 30 days free, then $10/month.",
    "Providers",
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
        crumb="Providers"
        title="A peer-to-peer network for Florida NEMT providers"
        img={HOME_IMAGES.provider}
        intro={<>
          <p>Connect with other providers, share trips you need help covering and review opportunities from across the network.</p>
          <p className="opacity-90">Connect business to business, provider to provider or contractor to contractor when additional transportation support is needed.</p>
        </>}
      >
        <a href={LINKS.join} className={`${btnAction} home-primary-cta`}><Network aria-hidden />Join the Provider Network</a>
        <a href="/how-it-works" className={btnOnBlue}>How It Works</a>
      </PageHero>

      <section aria-labelledby="p2p-title" className="mfn-section bg-ds-subtle">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14">
          <SectionHead align="left" id="p2p-title" title="When you can’t cover a trip, another provider might." intro="Share a trip you can’t take, or pick up one a fellow provider needs covered. Both sides review the details and terms before anything is accepted." />
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

      <section aria-labelledby="road-title" className="bg-ds-sky pt-12 pb-10 lg:pt-20 lg:pb-14">
        <div className="mfn-container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <SectionHead align="left" id="road-title" title="Built for the road, not just the office." intro="The whole provider experience — trip opportunities, sharing, Smart Notes, schedules, status and messages — is designed to work on a desktop at the office, a tablet in the van or a phone between trips. Features will be introduced and expanded as the network grows." />
          <ul className="grid grid-cols-3 gap-4">
            {[{ i: Monitor, t: "Desktop" }, { i: Tablet, t: "Tablet" }, { i: Smartphone, t: "Mobile" }].map(({ i: I, t }) => (
              <li key={t} className="flex flex-col items-center gap-3 rounded-ds bg-ds-surface px-3 py-8 shadow-ds">
                <I className="size-12 text-ds-primary" aria-hidden /><span className="ds-subheading text-ds-primary">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="ind-title" className="bg-ds-sky pb-12 lg:pb-20">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <SectionHead align="left" id="ind-title" title="Your business stays yours." />
          <ul className="grid gap-3 sm:grid-cols-2">
            {INDEPENDENCE.map((t) => <li key={t} className="ds-body-lg flex gap-3 rounded-ds bg-ds-surface p-5 shadow-ds"><ShieldCheck className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>

      <section aria-labelledby="team-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-14">
          <Reveal direction="left"><SectionHead align="left" id="team-title" title="Manage your NEMT team and contractors" intro="Bring your transportation business, team members and independent contractors into one organized workspace. Assign appropriate access, coordinate work and keep trip information connected without relying on shared logins." /></Reveal>
          <Reveal direction="right">
            <ul className="grid gap-3">
              {["Each person signs in with their own email — no shared credentials", "Owner, admin and member access levels for your workspace", "Share trip opportunities with other independent businesses or contractors", "Your business decides who it works with — MY FLORIDA NEMT does not employ contractors or decide employment status"].map((t) => <li key={t} className="ds-body-lg flex gap-3 rounded-ds bg-ds-sky p-5"><Users2 className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{t}</li>)}
            </ul>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="train-title" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <Reveal><SectionHead id="train-title" title="Do you need NEMT training?" intro="Training is purchased separately from network membership. Each class is sold on its own." /></Reveal>
          <div className="mx-auto mt-10 grid max-w-4xl gap-5 md:grid-cols-2">
            {TRAINING.map((t, i) => (
              <Reveal key={t.href} delay={i * 80}>
                <a href={t.href} className="group flex h-full items-center gap-4 rounded-ds bg-ds-sky p-6 ds-transition hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-ds-sm bg-ds-primary text-ds-on-primary"><GraduationCap className="size-6" aria-hidden /></span>
                  <h3 className="ds-subheading flex-1 uppercase text-ds-primary">{t.title}</h3>
                  <ArrowRight className="size-5 text-ds-link ds-transition group-hover:translate-x-1" aria-hidden />
                </a>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="membership" aria-labelledby="member-title" className="mfn-section scroll-mt-24 bg-ds-membership text-ds-primary">
        <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
          <div>
                        <h2 id="member-title" className="mt-4 font-heading text-6xl font-bold uppercase leading-none sm:text-7xl">30 days <span className="text-ds-accent-active">free</span></h2>
            <p className="ds-section-title mt-5">Then $10 per month. Cancel anytime.</p>
            <p className="ds-body-lg mfn-read mt-4">Membership gives you access to the provider network and its core tools — sharing trips, reviewing opportunities and following trips to completion.</p>
            <div className="mt-7"><a href={LINKS.join} className={btnBlue}><Network aria-hidden />Join the Provider Network</a></div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              { i: LayoutGrid, t: "30 days free, then $10 per month" },
              { i: BadgePercent, t: "2% MY FLORIDA NEMT platform fee on completed trips received through the provider network" },
              { i: CreditCard, t: "Payment-processing fees may apply" },
              { i: CalendarX, t: "No long-term contract — cancel anytime" },
            ].map(({ i: I, t }) => <li key={t} className="ds-body-lg flex gap-3 rounded-ds-sm bg-ds-surface p-5"><I className="mt-0.5 size-6 shrink-0 text-ds-primary" aria-hidden />{t}</li>)}
          </ul>
        </div>
      </section>

    </PublicPage>
  );
}

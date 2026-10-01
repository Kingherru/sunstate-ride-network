import {
  Accessibility, ArrowLeftRight, BadgePercent, BedSingle, CalendarPlus, ClipboardCheck, CreditCard, Footprints, LayoutDashboard, LayoutGrid, Network, Package, Truck, UserPlus, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES as IMG, LINKS } from "@/lib/site-config";
import { btnAction, btnBlue, btnOnBlue } from "./buttons";
import { HomeReveal } from "./HomeReveal";

export { btnAction as btnPrimary };

function Img({ img, className, eager }: { img: (typeof IMG)[keyof typeof IMG]; className?: string; eager?: boolean }) {
  return <img src={img.src} width={img.w} height={img.h} alt={img.alt} loading={eager ? "eager" : "lazy"} className={cn("h-full w-full object-cover", className)} />;
}

/* 1 — Hero */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-ds-primary text-ds-on-primary">
      <HomeReveal direction="right" className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[55%]">
        <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full">
          <Img img={IMG.hero} eager className="object-[35%_center]" />
          {/* same-color fade: blue → transparent */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ds-primary to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-1/3 lg:bg-gradient-to-r" />
        </div>
      </HomeReveal>
      <div className="relative mfn-container pb-12 pt-4 lg:py-28">
        <HomeReveal direction="left" className="max-w-2xl lg:max-w-[42%]">
          <p className="ds-label tracking-wide text-ds-accent">FLORIDA PEER-TO-PEER NEMT NETWORK</p>
          <h1 id="hero-title" className="ds-display mt-4 uppercase">FLORIDA NEMT, <span className="text-ds-accent">CONNECTED.</span></h1>
          <p className="ds-body-lg mt-5 text-[1.25rem] opacity-95 sm:text-[1.3125rem]">Request transportation or connect provider-to-provider. MY FLORIDA NEMT brings customers, facilities and independent providers together through one statewide peer network.</p>
          <p className="ds-subheading mt-4">Public booking and provider-to-provider connections—built into the same network.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.book} className={`${btnAction} home-primary-cta`}><CalendarPlus aria-hidden />Book a Trip</a>
            <a href={LINKS.join} className={`${btnOnBlue} home-primary-cta`}><Network aria-hidden />Join the Provider Network</a>
          </div>
        </HomeReveal>
      </div>
    </section>
  );
}

/* 2 — Combined network and connection section */
const PATHS = [
  { id: "path-public", icon: Users, label: "Customers & Facilities → Providers", t: "Request planned transportation",
    d: "Customers and authorized facility teams submit planned trip needs and connect with participating providers based on the trip, location and availability.",
    cta: { href: LINKS.book, label: "Book a Trip", icon: CalendarPlus, cls: btnAction } },
  { id: "path-p2p", icon: ArrowLeftRight, label: "Provider ↔ Provider", t: "Connect with other providers",
    d: "Participating NEMT businesses share opportunities, review trips and help one another cover transportation needs across Florida, provider to provider.",
    cta: { href: LINKS.join, label: "Join the Provider Network", icon: Network, cls: btnBlue } },
];
const STEPS = [
  { icon: UserPlus, t: "Create your provider account", d: "Set up your business sign-in and give the right team members access." },
  { icon: ClipboardCheck, t: "Complete your service profile", d: "Add services, counties, hours and vehicles to show your coverage." },
  { icon: Network, t: "Connect through the network", d: "Review opportunities, share uncovered trips and reach other providers." },
  { icon: LayoutDashboard, t: "Manage trips in one place", d: "Keep trip details, status updates and messages organized on any device." },
];
export function NetworkConnect() {
  return (
    <section id="how-it-works" aria-labelledby="connect-title" className="mfn-section scroll-mt-20 bg-ds-subtle">
      <div className="mfn-container">
        <HomeReveal className="mx-auto max-w-5xl text-center">
          <p className="ds-label text-ds-accent-active">How it works</p>
          <h2 id="connect-title" className="ds-page-title mt-2 uppercase text-ds-primary"><span className="lg:block">ONE FLORIDA NEMT NETWORK.</span> <span className="lg:block">TWO WAYS TO CONNECT.</span></h2>
          <p className="ds-body-lg mx-auto mt-4 max-w-[44rem] text-ds-text-2">MY FLORIDA NEMT connects customers and facilities with participating transportation providers while also giving independent NEMT businesses a practical way to connect with one another.</p>
        </HomeReveal>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {PATHS.map((p) => (
            <HomeReveal key={p.id} direction={p.id === "path-public" ? "left" : "right"} className="h-full">
            <article aria-labelledby={p.id} className="flex h-full flex-col rounded-ds-lg bg-ds-surface p-7 shadow-ds sm:p-9">
              <p className="ds-label flex items-center gap-2 text-ds-primary"><p.icon className="size-5" aria-hidden />{p.label}</p>
              <h3 id={p.id} className="ds-section-title mt-3 text-ds-primary">{p.t}</h3>
              <p className="ds-body-lg mt-3 flex-1 text-ds-text-2">{p.d}</p>
              <div className="mt-6"><a href={p.cta.href} className={p.cta.cls}><p.cta.icon aria-hidden />{p.cta.label}</a></div>
            </article>
            </HomeReveal>
          ))}
        </div>
        <h3 className="ds-subheading mt-14 text-center text-ds-primary">Getting started as a provider</h3>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.t} className="h-full"><HomeReveal delay={i * 85} className="h-full">
              <article className="grid h-full grid-rows-[3rem_4.4rem_1fr] rounded-ds bg-ds-primary p-6 text-center text-ds-on-primary">
                <s.icon className="mx-auto size-10 text-ds-accent" strokeWidth={1.8} aria-hidden />
                <h3 className="ds-subheading mt-4 flex items-start justify-center uppercase tracking-[0.02em]">{s.t}</h3>
                <p className="ds-body-lg mt-5 opacity-90">{s.d}</p>
              </article>
            </HomeReveal></li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* Services */
const SERVICES = [
  { n: "Ambulatory", icon: Footprints, d: "For riders who walk on their own or with light help, including door-to-door support." },
  { n: "Wheelchair", icon: Accessibility, d: "Ramp- or lift-equipped vehicles for riders who stay seated in a wheelchair." },
  { n: "Stretcher or specialized", icon: BedSingle, d: "For riders who need to lie flat or need positioning support, never emergencies." },
  { n: "Medical delivery", icon: Package, d: "Time-sensitive pickups and drop-offs of medical items, supplies and paperwork." },
];
export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="mfn-section scroll-mt-20 bg-ds-bg">
      <div className="mfn-container grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <HomeReveal direction="left" className="text-center lg:text-left">
          <p className="ds-label text-ds-accent-active">Services</p>
          <h2 id="services-title" className="ds-page-title mt-2 uppercase text-ds-primary">TRANSPORTATION NEEDS ARE DIFFERENT. THE STARTING POINT SHOULD BE SIMPLE.</h2>
          <p className="ds-body-lg mt-4 text-ds-text-2">Start with the essential trip details and connect with participating Florida providers for ambulatory, wheelchair, stretcher and medical delivery needs.</p>
          <div className="mt-7"><a href={LINKS.book} className={`${btnAction} home-primary-cta w-full sm:w-auto`}><CalendarPlus aria-hidden />Book a Trip</a></div>
        </HomeReveal>
        <ul className="grid gap-4 sm:grid-cols-2">
          {SERVICES.map((s, i) => (
            <li key={s.n} className="h-full"><HomeReveal delay={i * 85} className="grid h-full grid-rows-[auto_auto_1fr] rounded-ds bg-ds-subtle p-6 text-center">
              <span className="mx-auto flex size-14 items-center justify-center rounded-ds-sm bg-ds-surface text-ds-primary"><s.icon className="size-8" aria-hidden /></span>
              <h3 className="ds-subheading mt-4 text-[1.3125rem] uppercase text-ds-primary">{s.n}</h3>
              <p className="ds-body-lg mt-2 text-ds-text-2">{s.d}</p>
            </HomeReveal></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* Membership */
export function Membership() {
  const terms = [
    { icon: LayoutGrid, t: "30 days free, then $10 per month" },
    { icon: BadgePercent, t: "2% platform fee on completed trips received through the provider network" },
    { icon: CreditCard, t: "Payment-processing fees may apply" },
  ];
  return (
    <section id="membership" aria-labelledby="member-title" className="mfn-section scroll-mt-20 bg-ds-membership text-ds-primary">
      <HomeReveal className="mfn-container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <p className="ds-label flex items-center gap-2 text-ds-accent-active"><Truck className="size-5" aria-hidden />Provider membership</p>
          <h2 id="member-title" className="mt-4 font-heading text-6xl font-bold uppercase leading-none sm:text-7xl">30 DAYS <span className="text-ds-accent">FREE</span></h2>
          <p className="ds-section-title mt-5 uppercase">TRY THE COMPLETE PROVIDER NETWORK FREE FOR 30 DAYS.</p>
          <div className="mt-7"><a href={LINKS.join} className={`${btnBlue} home-primary-cta`}><Network aria-hidden />Join the Provider Network</a></div>
        </div>
        <ul className="grid gap-3">
          {terms.map(({ icon: Icon, t }) => (
            <li key={t} className="ds-body-lg flex items-center gap-4 rounded-ds-sm bg-ds-surface p-5 text-[1.125rem] shadow-ds"><Icon className="size-6 shrink-0 text-ds-accent-active" aria-hidden />{t}</li>
          ))}
        </ul>
      </HomeReveal>
    </section>
  );
}

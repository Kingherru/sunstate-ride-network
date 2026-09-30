import { Link } from "@tanstack/react-router";
import {
  Accessibility, ArrowLeftRight, ArrowRight, BadgePercent, BedSingle, BookOpen, CalendarPlus, CalendarX,
  ClipboardList, CreditCard, Footprints, GraduationCap, LayoutGrid, Network, Package, Tag, Truck, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES as IMG, LINKS } from "@/lib/site-config";
import { btnAction, btnBlue, btnOnBlue, focusRing } from "./buttons";

export { btnAction as btnPrimary };

function Img({ img, className, eager }: { img: (typeof IMG)[keyof typeof IMG]; className?: string; eager?: boolean }) {
  return <img src={img.src} width={img.w} height={img.h} alt={img.alt} loading={eager ? "eager" : "lazy"} className={cn("h-full w-full object-cover", className)} />;
}

/* 1 — Hero */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden bg-ds-primary text-ds-on-primary">
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-[55%]">
        <div className="relative aspect-[16/10] lg:aspect-auto lg:h-full">
          <Img img={IMG.hero} eager className="object-[35%_center]" />
          {/* same-color fade: blue → transparent */}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-ds-primary to-transparent lg:inset-y-0 lg:left-0 lg:right-auto lg:h-full lg:w-1/3 lg:bg-gradient-to-r" />
        </div>
      </div>
      <div className="relative mfn-container pb-12 pt-4 lg:py-28">
        <div className="max-w-2xl lg:max-w-[42%]">
          <p className="ds-label tracking-wide text-ds-accent">FLORIDA PEER-TO-PEER NEMT NETWORK</p>
          <h1 id="hero-title" className="ds-display mt-4">Florida NEMT, <span className="text-ds-accent">connected.</span></h1>
          <p className="ds-body-lg mt-5 text-[1.25rem] opacity-95 sm:text-[1.3125rem]">Request transportation or connect provider-to-provider. My Florida NEMT brings customers, facilities and independent providers together through one statewide peer network.</p>
          <p className="ds-subheading mt-4">Public booking and provider-to-provider connections—built into the same network.</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.book} className={btnAction}><CalendarPlus aria-hidden />Book a Trip</a>
            <a href={LINKS.join} className={btnOnBlue}><Network aria-hidden />Join the Provider Network</a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 2 — One network, two ways to connect */
function Tile({ icon: Icon, label, tone }: { icon: typeof Users; label: string; tone: string }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-2 rounded-ds px-3 py-4 text-center", tone)}>
      <Icon className="size-7 text-ds-primary" aria-hidden />
      <span className="ds-label text-ds-primary">{label}</span>
    </div>
  );
}
function Connector({ both }: { both?: boolean }) {
  return (
    <div aria-hidden className="relative flex w-10 shrink-0 items-center sm:w-16">
      <span className="h-0.5 w-full bg-ds-primary" />
      <span className="absolute -right-0.5 size-2.5 rotate-45 border-r-2 border-t-2 border-ds-primary" />
      {both && <span className="absolute -left-0.5 size-2.5 -rotate-[135deg] border-r-2 border-t-2 border-ds-primary" />}
    </div>
  );
}
export function NetworkModel() {
  const facts = [
    "Independent providers remain independent.",
    "My Florida NEMT supports the connection and organization process.",
    "We are not a traditional dispatch company.",
    "Provider availability isn’t guaranteed for every request.",
  ];
  return (
    <section aria-labelledby="model-title" className="bg-ds-subtle py-10 sm:py-14">
      <div className="mfn-container grid gap-8 lg:grid-cols-[1fr_1.6fr] lg:items-center lg:gap-12">
        <div>
          <p className="ds-label text-ds-accent-active">ONE NETWORK. TWO WAYS TO CONNECT.</p>
          <h2 id="model-title" className="ds-section-title mt-2 text-ds-primary">A peer-to-peer Florida NEMT network with a public booking connection for customers and facilities.</h2>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {facts.map((f) => <li key={f} className="ds-body flex gap-2 text-ds-text-2"><span aria-hidden className="mt-2.5 h-0.5 w-3 shrink-0 bg-ds-accent" />{f}</li>)}
          </ul>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <figure className="rounded-ds bg-ds-surface p-5 shadow-ds">
            <figcaption className="ds-label flex items-center gap-2 text-ds-primary"><CalendarPlus className="size-5" aria-hidden />Public booking connection</figcaption>
            <div className="mt-4 flex items-center" role="img" aria-label="Customers and facilities connect to independent providers">
              <Tile icon={Users} label="Customers & Facilities" tone="bg-ds-sky" />
              <Connector />
              <Tile icon={Truck} label="Independent Providers" tone="bg-ds-subtle" />
            </div>
          </figure>
          <figure className="rounded-ds bg-ds-surface p-5 shadow-ds">
            <figcaption className="ds-label flex items-center gap-2 text-ds-primary"><ArrowLeftRight className="size-5" aria-hidden />Provider-to-provider connection</figcaption>
            <div className="mt-4 flex items-center" role="img" aria-label="Providers connect directly with other providers">
              <Tile icon={Truck} label="Provider" tone="bg-ds-peach" />
              <Connector both />
              <Tile icon={Truck} label="Provider" tone="bg-ds-peach" />
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}

/* Services */
const SERVICES = [
  { n: "Ambulatory", icon: Footprints, d: "For riders who can walk with little or no help, with door-to-door support when needed.", tone: "bg-ds-sky" },
  { n: "Wheelchair", icon: Accessibility, d: "Ramp- or lift-equipped vehicles for riders who travel in their own or a provided wheelchair.", tone: "bg-ds-green" },
  { n: "Stretcher or gurney", icon: BedSingle, d: "For riders who need to lie down during the trip and don’t need emergency care.", tone: "bg-ds-sand" },
  { n: "Medical delivery", icon: Package, d: "Time-sensitive pickups and drop-offs of medical items, supplies and samples.", tone: "bg-ds-peach" },
];
export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="mfn-section bg-ds-bg scroll-mt-20">
      <div className="mfn-container grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="ds-label text-ds-accent-active">Services</p>
          <h2 id="services-title" className="ds-page-title mt-2 text-ds-primary">Transportation needs are different. The starting point should be simple.</h2>
          <p className="ds-body-lg mfn-read mt-4 text-ds-text-2">Request these services from independent Florida providers. Each trip is carried out by the provider who accepts it.</p>
          <div className="mt-8 aspect-[16/10] overflow-hidden rounded-ds-lg"><Img img={IMG.stretcher} /></div>
        </div>
        <div className="flex flex-col justify-center">
          <ul className="grid gap-4">
            {SERVICES.map((s) => (
              <li key={s.n} className="flex gap-5 rounded-ds bg-ds-subtle p-5 sm:p-6">
                <span className={cn("flex size-14 shrink-0 items-center justify-center rounded-ds-sm text-ds-primary", s.tone)}><s.icon className="size-8" aria-hidden /></span>
                <div>
                  <h3 className="ds-subheading text-[1.375rem] text-ds-primary">{s.n}</h3>
                  <p className="ds-body-lg mt-1 text-ds-text-2">{s.d}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-6"><a href={LINKS.book} className={btnAction}><CalendarPlus aria-hidden />Book a Trip</a></div>
        </div>
      </div>
    </section>
  );
}

/* Membership */
export function Membership() {
  const included = [
    { icon: LayoutGrid, t: "Core provider-network tools included" },
    { icon: CalendarX, t: "Cancel anytime" },
  ];
  const fees = [
    { icon: BadgePercent, t: "2% platform fee on completed trips received through the network" },
    { icon: CreditCard, t: "Payment-processing fees may apply when payments are processed through the platform" },
    { icon: Tag, t: "Optional paid lead tools may be offered separately" },
    { icon: GraduationCap, t: "Training classes are purchased separately" },
  ];
  const Item = ({ icon: Icon, t }: { icon: typeof Tag; t: string }) => (
    <li className="ds-body-lg flex gap-3 rounded-ds-sm bg-ds-primary-hover p-4 text-[1.0625rem]"><Icon className="mt-0.5 size-6 shrink-0 text-ds-accent" aria-hidden />{t}</li>
  );
  return (
    <section id="membership" aria-labelledby="member-title" className="mfn-section bg-ds-primary text-ds-on-primary scroll-mt-20">
      <div className="mfn-container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center lg:gap-16">
        <div>
          <p className="ds-label flex items-center gap-2 text-ds-accent"><Network className="size-5" aria-hidden />Provider membership</p>
          <p className="mt-4 font-heading text-6xl font-bold uppercase leading-none sm:text-7xl">30 days <span className="text-ds-accent">free</span></p>
          <h2 id="member-title" className="ds-section-title mt-5">Try the complete provider network free for 30 days.</h2>
          <p className="mt-5 inline-flex items-baseline gap-2 rounded-ds-sm bg-ds-on-primary/10 px-4 py-2"><span className="font-heading text-3xl font-bold">$10/month</span><span className="ds-body-lg opacity-90">after the 30-day trial</span></p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.join} className={btnAction}><Network aria-hidden />Start 30 Days Free</a>
            <a href="#providers" className={btnOnBlue}><ArrowRight aria-hidden />See Provider Benefits</a>
          </div>
        </div>
        <div className="grid gap-6">
          <div>
            <h3 className="ds-subheading">Included</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{included.map((i) => <Item key={i.t} {...i} />)}</ul>
          </div>
          <div>
            <h3 className="ds-subheading">What to know about fees</h3>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">{fees.map((i) => <Item key={i.t} {...i} />)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* Training & resources */
export function Training() {
  const res = [
    { icon: ClipboardList, t: "Provider operations class", d: "Day-to-day practices for running NEMT trips well.", tone: "bg-ds-sky" },
    { icon: BookOpen, t: "Florida NEMT business resource", d: "Practical guidance for starting and growing a Florida NEMT business.", tone: "bg-ds-green" },
    { icon: Package, t: "Customer & facility transportation guide", d: "What to know before requesting a non-emergency trip.", tone: "bg-ds-peach" },
  ];
  return (
    <section id="resources" aria-labelledby="training-title" className="mfn-section bg-ds-subtle scroll-mt-20">
      <div className="mfn-container">
        <div id="training" className="grid gap-8 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
          <div>
            <p className="ds-label flex items-center gap-2 text-ds-accent-active"><GraduationCap className="size-5" aria-hidden />Training & resources</p>
            <h2 className="ds-page-title mt-2 text-ds-primary" id="training-title">Build stronger NEMT knowledge.</h2>
            <p className="ds-body-lg mfn-read mt-4 text-[1.25rem] text-ds-text-2">Provider training and practical resources are available separately from network membership.</p>
            <p className="ds-subheading mt-5 text-ds-on-subtle">Training classes are $50 each unless a specific course displays a different approved price.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/shop" className={btnBlue}><GraduationCap aria-hidden /> Explore Training</Link>
              <a href="#resources-list" className="ds-button-text ds-transition inline-flex min-h-13 items-center gap-2 rounded-ds px-2 text-ds-link hover:text-ds-link-hover hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus focus-visible:ring-offset-2 [&_svg]:size-5 [&_svg]:shrink-0">
                <BookOpen aria-hidden />View Resources
              </a>
            </div>
          </div>
          <div id="resources-list" className="grid gap-4 sm:grid-cols-2 lg:gap-6">
            {res.map((r) => (
              <div key={r.t} className={cn("rounded-ds p-6 text-ds-on-soft sm:p-7", r.tone)}>
                <r.icon className="size-7 text-ds-primary" aria-hidden />
                <h3 className="ds-subheading mt-4 text-[1.375rem] text-ds-primary">{r.t}</h3>
                <p className="ds-body-lg mt-2">{r.d}</p>
              </div>
            ))}
            <Link to="/shop" className={cn("group flex flex-col justify-between rounded-ds bg-ds-primary p-6 text-ds-on-primary ds-transition hover:bg-ds-primary-hover sm:p-7", focusRing)}>
              <div>
                <p className="ds-label flex items-center gap-2 text-ds-accent"><GraduationCap className="size-5" aria-hidden />Training Shop</p>
                <p className="ds-subheading mt-2 text-[1.375rem]">Browse available classes</p>
              </div>
              <p className="mt-6 flex items-end justify-between"><span><span className="font-heading text-5xl font-bold">$50</span> <span className="ds-body-lg opacity-90">per class</span></span><ArrowRight className="size-7 text-ds-accent" aria-hidden /></p>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

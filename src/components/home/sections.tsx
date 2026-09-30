import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen, Check, ClipboardList, GraduationCap, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOME_IMAGES as IMG, LINKS } from "@/lib/site-config";

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus focus-visible:ring-offset-2";
const btn = "ds-button-text ds-transition inline-flex min-h-13 items-center justify-center gap-2 px-7 text-[1.0625rem] hover:-translate-y-px";
export const btnPrimary = cn(btn, "bg-ds-accent text-ds-on-accent hover:bg-ds-accent-hover", focusRing);
const btnOnBlue = cn(btn, "bg-ds-surface text-ds-primary hover:bg-ds-sky", focusRing, "focus-visible:ring-offset-ds-primary");
const btnSecondary = cn(btn, "bg-ds-primary text-ds-on-primary hover:bg-ds-primary-hover", focusRing);
const textLink = cn("ds-button-text ds-transition inline-flex items-center gap-1.5 rounded-sm text-ds-primary underline-offset-4 hover:underline", focusRing);

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
      <div className="relative mfn-container pb-16 pt-6 lg:py-36">
        <div className="max-w-2xl lg:max-w-[40%]">
          <p className="ds-label tracking-wide opacity-90">FLORIDA NON-EMERGENCY MEDICAL TRANSPORTATION NETWORK</p>
          <h1 id="hero-title" className="ds-display mt-4">Florida NEMT, <span className="text-ds-accent">connected.</span></h1>
          <p className="ds-body-lg mt-6 text-[1.25rem] opacity-95 sm:text-[1.3125rem]">Request medical transportation, connect with independent Florida providers, and give your NEMT business practical tools for managing opportunities—all through one statewide network.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.book} className={btnPrimary}>Book a Trip</a>
            <a href={LINKS.join} className={btnOnBlue}>Join the Provider Network</a>
          </div>
          <p className="ds-body mt-7 opacity-90">For private-pay riders, families, facilities, hospitals and independent Florida NEMT providers.</p>
        </div>
      </div>
    </section>
  );
}

/* 2 — Visitor paths (editorial split, not identical cards) */
export function Paths() {
  return (
    <section id="paths" aria-labelledby="paths-title" className="bg-ds-bg py-20 sm:py-28 scroll-mt-20">
      <div className="mfn-container">
        <h2 id="paths-title" className="ds-page-title max-w-2xl text-ds-primary">What brings you to My Florida NEMT?</h2>

        <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:items-stretch">
          {/* Path 1 — large photo w/ overlapping text */}
          <article className="relative lg:col-span-7">
            <div className="aspect-[4/3] overflow-hidden lg:aspect-[6/5]"><Img img={IMG.family} className="object-[center_30%]" /></div>
            <div className="relative -mt-20 mx-4 bg-ds-peach p-7 text-ds-on-soft sm:mx-10 sm:p-10">
              <p className="ds-label text-ds-accent-active">01</p>
              <h3 className="ds-section-title mt-1 text-ds-primary">I need transportation</h3>
              <p className="ds-body-lg mt-3">Request ambulatory, wheelchair or stretcher transportation for yourself, a family member or someone in your care.</p>
              <a href={LINKS.book} className={cn(btnPrimary, "mt-5")}>Start a Trip Request</a>
            </div>
          </article>

          <div className="flex flex-col gap-8 lg:col-span-5">
            {/* Path 2 — photo top, text below on green */}
            <article id="facilities" className="overflow-hidden rounded-ds bg-ds-green text-ds-on-soft">
              <div className="aspect-[16/9]"><Img img={IMG.facility} className="object-[center_25%]" /></div>
              <div className="p-7 sm:p-9">
                <p className="ds-label text-ds-accent-active">02</p>
                <h3 className="ds-section-title mt-1 text-ds-primary">I’m booking for a facility</h3>
                <p className="ds-body-lg mt-3">Organize transportation requests for patients or residents and keep recurring trip information easier to manage.</p>
                <a href="#how-it-works" className={cn(textLink, "mt-4")}>Explore Facility Booking <ArrowRight className="size-4" aria-hidden /></a>
              </div>
            </article>
            {/* Path 3 — solid blue split with portrait */}
            <article className="grid flex-1 overflow-hidden bg-ds-primary text-ds-on-primary sm:grid-cols-[1fr_42%]">
              <div className="p-7 sm:p-9">
                <p className="ds-label text-ds-accent">03</p>
                <h3 className="ds-section-title mt-1">I provide transportation</h3>
                <p className="ds-body-lg mt-3 opacity-95">Connect with other Florida providers, review trip opportunities and use lightweight tools built around everyday NEMT work.</p>
                <a href="#providers" className="ds-button-text ds-transition mt-4 inline-flex items-center gap-1.5 rounded-sm underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-on-primary">Explore Provider Benefits <ArrowRight className="size-4" aria-hidden /></a>
              </div>
              <div className="order-first aspect-[16/9] sm:order-none sm:aspect-auto"><Img img={IMG.provider} className="object-[center_20%]" /></div>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 5 — Services */
const SERVICES = [
  { n: "Ambulatory", d: "For riders who can walk with little or no help, with door-to-door support when needed.", tone: "bg-ds-sky" },
  { n: "Wheelchair", d: "Ramp- or lift-equipped vehicles for riders who travel in their own or a provided wheelchair.", tone: "bg-ds-green" },
  { n: "Stretcher or gurney", d: "For riders who need to lie down during the trip and don’t need emergency care.", tone: "bg-ds-sand" },
  { n: "Medical delivery", d: "Time-sensitive pickups and drop-offs of medical items, supplies and samples.", tone: "bg-ds-peach" },
];
export function Services() {
  return (
    <section id="services" aria-labelledby="services-title" className="bg-ds-bg py-20 sm:py-28 scroll-mt-20">
      <div className="mfn-container grid gap-12 lg:grid-cols-2 lg:gap-20">
        <div>
          <p className="ds-label text-ds-accent-active">Services</p>
          <h2 id="services-title" className="ds-page-title mt-2 text-ds-primary">Transportation needs are different. The starting point should be simple.</h2>
          <p className="ds-body-lg mt-4 text-ds-text-2">My Florida NEMT helps you request these services from independent Florida providers. Each trip is carried out by the provider who accepts it.</p>
          <div className="mt-10 aspect-[16/11] overflow-hidden"><Img img={IMG.stretcher} /></div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.book} className={btnPrimary}>Book a Trip</a>
            <a href="#how-it-works" className={cn(btn, "bg-ds-subtle text-ds-primary hover:bg-ds-hover", focusRing)}>Explore Services</a>
          </div>
        </div>
        <div className="lg:pt-24">
          <ul className="divide-y divide-ds-border border-y border-ds-border">
            {SERVICES.map((s, i) => (
              <li key={s.n} className="flex gap-6 py-9">
                <span className={cn("flex size-16 shrink-0 items-center justify-center font-heading text-xl font-bold text-ds-primary", s.tone)}>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="ds-section-title text-ds-primary">{s.n}</h3>
                  <p className="ds-body-lg mt-1.5 text-ds-text-2">{s.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* 7 — Founder story */
const PAINS = [
  "Finding reliable provider connections in other cities was hard.",
  "Trip information arrived incomplete or scattered.",
  "Good opportunities needed a way to be shared between providers.",
  "Referrals shouldn’t require another complicated dispatch platform.",
  "Customer and trip details needed a faster way to stay organized.",
];
export function Founder() {
  return (
    <section id="about" aria-labelledby="about-title" className="bg-ds-sand py-20 text-ds-on-soft sm:py-28 scroll-mt-20">
      <div className="mfn-container grid gap-12 lg:grid-cols-[42fr_58fr] lg:gap-20 lg:items-center">
        <figure className="relative w-full">
          <div className="aspect-[5/6] overflow-hidden"><Img img={IMG.founder} className="object-[60%_center]" /></div>
          <figcaption className="ds-caption mt-2">Representative photo of a working Florida provider.</figcaption>
        </figure>
        <div className="mfn-read lg:max-w-[46rem]">
          <p className="ds-label text-ds-accent-active">Our story</p>
          <h2 id="about-title" className="ds-page-title mt-2 text-ds-primary">Created from inside the NEMT business.</h2>
          <p className="ds-body-lg mt-5 text-[1.25rem]">My Florida NEMT was started by a working Florida NEMT provider who dealt with the same everyday problems other providers face:</p>
          <ul className="mt-6 space-y-3">
            {PAINS.map((p) => (
              <li key={p} className="ds-body-lg flex gap-4 text-[1.1875rem]"><span className="mt-1.5 flex size-5 shrink-0 items-center justify-center bg-ds-primary text-ds-on-primary"><Check className="size-3" aria-hidden /></span>{p}</li>
            ))}
          </ul>
          <p className="ds-subheading mt-8 text-ds-primary">My Florida NEMT is being built to make those everyday connections and details easier to manage.</p>
        </div>
      </div>
    </section>
  );
}

/* 8 — Membership */
export function Membership() {
  const items = [
    "$10 per month after the 60-day trial",
    "Core provider-network tools included",
    "Cancel anytime",
    "A 2% platform fee applies to completed trips received through the network",
    "Payment-processing fees may also apply when payments are processed through the platform",
    "Optional paid lead tools may be offered separately",
    "Training classes are purchased separately",
  ];
  return (
    <section id="membership" aria-labelledby="member-title" className="relative overflow-hidden bg-ds-primary py-20 text-ds-on-primary sm:py-28">
      <div className="mfn-container grid gap-12 lg:grid-cols-2 lg:gap-24 lg:items-center">
        <div>
          <p className="ds-label text-ds-accent">Provider membership</p>
          <h2 id="member-title" className="ds-page-title mt-2">Try the complete provider network free for 60 days.</h2>
          <p className="mt-6 flex items-baseline gap-2"><span className="font-heading text-6xl font-bold sm:text-7xl">$10</span><span className="ds-body-lg opacity-90">per month after the trial</span></p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={LINKS.join} className={btnPrimary}>Start 60 Days Free</a>
            <a href="#providers" className={btnOnBlue}>See Provider Benefits</a>
          </div>
        </div>
        <ul className="border-t border-ds-on-primary/20">
          {items.map((t) => (
            <li key={t} className="ds-body-lg flex gap-4 border-b border-ds-on-primary/20 py-5 text-[1.1875rem]"><Check className="mt-1 size-5 shrink-0 text-ds-accent" aria-hidden />{t}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* 9 — Training & resources */
export function Training() {
  const res = [
    { icon: ClipboardList, t: "Provider operations class", d: "Day-to-day practices for running NEMT trips well.", tone: "bg-ds-sky" },
    { icon: BookOpen, t: "Florida NEMT business resource", d: "Practical guidance for starting and growing a Florida NEMT business.", tone: "bg-ds-green" },
    { icon: Package, t: "Customer & facility transportation guide", d: "What to know before requesting a non-emergency trip.", tone: "bg-ds-peach" },
  ];
  return (
    <section id="resources" aria-labelledby="training-title" className="bg-ds-subtle py-20 sm:py-28 scroll-mt-20">
      <div className="mfn-container">
        <div id="training" className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          <div>
            <p className="ds-label text-ds-accent-active">Training & resources</p>
            <h2 className="ds-page-title mt-2 text-ds-primary lg:text-[3rem]" id="training-title">Build stronger NEMT knowledge.</h2>
            <p className="ds-body-lg mt-5 text-[1.25rem] text-ds-text-2">Provider training and practical resources are available separately from network membership.</p>
            <p className="ds-subheading mt-6 text-ds-on-subtle">Training classes are $50 each unless a specific course displays a different approved price.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/shop" className={btnSecondary}><GraduationCap className="size-5" aria-hidden /> Explore Training</Link>
              <a href="#resources-list" className={cn(btn, "bg-ds-surface text-ds-primary hover:bg-ds-hover", focusRing)}>View Resources</a>
            </div>
          </div>
          <div id="resources-list" className="grid gap-5 sm:grid-cols-2">
            {res.map((r) => (
              <div key={r.t} className={cn("min-h-60 p-8 sm:p-10 text-ds-on-soft", r.tone)}>
                <r.icon className="size-8 text-ds-primary" aria-hidden />
                <h3 className="ds-section-title mt-5 text-ds-primary">{r.t}</h3>
                <p className="ds-body-lg mt-2">{r.d}</p>
              </div>
            ))}
            <Link to="/shop" className={cn("group flex min-h-60 flex-col justify-between bg-ds-primary p-8 text-ds-on-primary ds-transition hover:bg-ds-primary-hover sm:p-10", focusRing)}>
              <div>
                <p className="ds-label text-ds-accent">Training Shop</p>
                <p className="ds-section-title mt-2">Browse available classes</p>
              </div>
              <p className="mt-6 flex items-end justify-between"><span><span className="font-heading text-5xl font-bold">$50</span> <span className="ds-body-lg opacity-90">per class</span></span><ArrowRight className="size-7 text-ds-accent" aria-hidden /></p>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* 10 — Final conversion */
export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="border-t border-ds-border bg-ds-bg py-24 sm:py-32">
      <div className="mfn-container max-w-4xl text-center">
        <h2 id="final-title" className="ds-page-title text-ds-primary lg:text-[3rem]">Whether you need a trip or want to grow your NEMT business, start here.</h2>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={LINKS.book} className={btnPrimary}>Book a Trip</a>
          <a href={LINKS.join} className={btnSecondary}>Join the Provider Network</a>
        </div>
      </div>
    </section>
  );
}

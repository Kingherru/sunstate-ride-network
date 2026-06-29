import { createFileRoute, Link } from "@tanstack/react-router";
import heroVan from "@/assets/hero-van.jpg";
import { SectionHeading } from "@/components/site/SectionHeading";
import {
  ShieldCheck,
  BadgeCheck,
  Award,
  Headphones,
  PersonStanding,
  Accessibility,
  BedDouble,
  MapPin,
  GraduationCap,
  Truck,
  ArrowRight,
  CalendarClock,
} from "lucide-react";

const cities = [
  { code: "JAX-01", name: "Jacksonville", slug: "jacksonville" },
  { code: "ORL-02", name: "Orlando", slug: "orlando" },
  { code: "TPA-03", name: "Tampa", slug: "tampa" },
  { code: "MIA-04", name: "Miami", slug: "miami" },
  { code: "TLH-05", name: "Tallahassee", slug: "tallahassee" },
  { code: "FLL-06", name: "Fort Lauderdale", slug: "fort-lauderdale" },
] as const;

const trustItems = [
  { label: "HIPAA Compliant", Icon: ShieldCheck },
  { label: "Fully Insured & Bonded", Icon: BadgeCheck },
  { label: "Certified Professionals", Icon: Award },
  { label: "24/7 Dispatch", Icon: Headphones },
] as const;

const services = [
  {
    title: "Ambulatory",
    Icon: PersonStanding,
    description:
      "For independent patients needing reliable door-to-door transport for clinic visits, dialysis, and routine appointments.",
  },
  {
    title: "Wheelchair",
    Icon: Accessibility,
    description:
      "ADA-compliant hydraulic lifts and four-point securement systems for a stable, comfortable ride.",
  },
  {
    title: "Gurney / Stretcher",
    Icon: BedDouble,
    description:
      "Two-person crews specialized in non-emergency stretcher logistics for bed-to-bed transfers.",
  },
] as const;


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Florida NEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Dignified, on-time non-emergency medical transportation across Florida. Ambulatory, wheelchair, and stretcher transport plus a provider network and training academy.",
      },
      { property: "og:title", content: "Florida NEMT" },
      { property: "og:description", content: "Statewide non-emergency medical transportation across Florida." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <>
      {/* 1 · HERO — full-bleed navy band */}
      <section className="relative bg-[oklch(0.22_0.04_255)] text-white overflow-hidden">
        <div className="absolute inset-0 reliability-grid opacity-40 pointer-events-none" />
        <div
          className="absolute -top-32 -right-32 h-[36rem] w-[36rem] rounded-full pointer-events-none"
          style={{ background: "radial-gradient(circle, oklch(0.72 0.17 50 / 22%), transparent 60%)" }}
        />
        <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-28 lg:pt-32 lg:pb-36 grid lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-bold uppercase tracking-[0.18em] mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
              </span>
              Statewide · 24/7 Dispatch
            </div>
            <h1 className="font-display text-5xl lg:text-7xl font-extrabold tracking-tight leading-[0.95] mb-8 text-white">
              Florida's medical
              <br />
              transportation, <span className="text-accent-orange">on time.</span>
            </h1>
            <p className="text-lg lg:text-xl text-white/70 max-w-[55ch] leading-relaxed mb-10">
              One statewide network connecting patients, facilities, and vetted NEMT providers —
              with HIPAA-grade dispatch and a certified training academy behind every ride.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/request-a-ride" className="btn-accent">
                Request a Ride <ArrowRight size={16} />
              </Link>
              <Link
                to="/providers"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-[var(--radius)] bg-white/5 border border-white/20 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                <Truck size={16} /> Join the Provider Network
              </Link>
            </div>
          </div>
          <div className="lg:col-span-5 animate-slide-up [animation-delay:200ms]">
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-accent rounded-[28px] blur-2xl opacity-30" />
              <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/10 shadow-elegant">
                <img
                  src={heroVan}
                  alt="Florida NEMT van outside a clinic"
                  width={1280}
                  height={1600}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2 · TRUST TICKER */}
      <section className="bg-accent/10 border-y border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {trustItems.map(({ label, Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="size-9 rounded-md bg-accent/20 text-accent-orange flex items-center justify-center">
                <Icon size={18} strokeWidth={2.25} />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 3 · STATS BAND */}
      <section className="bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-border overflow-hidden">
          {[
            { stat: "67", unit: "FL counties", note: "Statewide reach" },
            { stat: "24/7", unit: "Dispatch", note: "Live coordinators" },
            { stat: "100%", unit: "Vetted", note: "Insurance · NPI · W-9" },
            { stat: "3", unit: "Transport tiers", note: "Ambulatory · Wheelchair · Stretcher" },
          ].map((s) => (
            <div key={s.stat} className="bg-background p-8">
              <div className="font-display text-5xl font-extrabold text-brand tracking-tight leading-none">{s.stat}</div>
              <div className="mt-3 text-xs font-mono uppercase tracking-[0.18em] text-accent-orange">{s.unit}</div>
              <div className="mt-2 text-sm text-muted-foreground">{s.note}</div>
            </div>
          ))}
        </div>
      </section>


      {/* 4 · SERVICES — full-bleed light band */}
      <section className="bg-secondary/60 section">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeading
            eyebrow="01 — Our Capabilities"
            title="Tailored Mobility Solutions"
            description="Specialized fleet configurations to support patients at every stage of their healthcare journey."
          />
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {services.map((s, i) => (
              <div
                key={s.title}
                className="group surface-card p-8 hover:-translate-y-1 transition-transform"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="size-12 rounded-md bg-brand text-primary-foreground flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                    <s.Icon size={24} strokeWidth={2} />
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
                </div>
                <h3 className="font-display text-2xl font-bold mb-3 text-brand">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link to="/services" className="btn-ghost">
              Compare all service levels <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* 5 · COVERAGE — full-bleed navy */}
      <section className="bg-[oklch(0.22_0.04_255)] text-white section relative overflow-hidden">
        <div className="absolute inset-0 reliability-grid opacity-30 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-14">
            <div>
              <p className="font-mono text-xs font-bold text-accent-orange uppercase tracking-[0.22em] mb-4">
                02 — Regional Reach
              </p>
              <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-white">
                Major hub coverage.
              </h2>
            </div>
            <p className="text-white/60 max-w-[44ch] leading-relaxed">
              Operating statewide with 24/7 dispatch across Florida's primary medical corridors.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cities.map((c) => (
              <Link
                key={c.slug}
                to="/service-areas/$city"
                params={{ city: c.slug }}
                className="group aspect-[4/3] bg-white/[0.04] border border-white/10 p-6 flex flex-col justify-between hover:bg-white/10 hover:border-accent transition-all rounded-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] text-white/40 tracking-widest">{c.code}</span>
                  <MapPin size={16} className="text-accent-orange opacity-70 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <h4 className="font-display text-2xl font-bold tracking-tight text-white">{c.name}</h4>
                  <div className="mt-2 text-xs text-white/50 group-hover:text-accent-orange transition-colors inline-flex items-center gap-1">
                    View region <ArrowRight size={12} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · TRAINING — full-bleed gradient */}
      <section className="section bg-gradient-hero">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-[2fr_3fr] gap-12 lg:gap-20 items-start">
          <div>
            <p className="font-mono text-xs font-bold text-accent-orange uppercase tracking-[0.22em] mb-4">
              03 — Career Development
            </p>
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight mb-6 text-brand">
              NEMT Training Academy.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-8">
              Professionalize your transport career with Florida-standard certification courses —
              required for all network providers, open to the public.
            </p>
            <Link to="/training" className="btn-primary">
              View Curriculum <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {[
              { title: "Florida NEMT Basics", desc: "State regulations, patient handling, and safety protocols." },
              { title: "HIPAA & Compliance", desc: "Privacy training for non-emergency medical drivers and dispatchers." },
            ].map((c) => (
              <div key={c.title} className="surface-panel p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 px-3 py-1.5 bg-accent text-accent-foreground font-mono text-[11px] font-bold">
                  $100
                </div>
                <div className="size-11 bg-brand/10 text-brand rounded-md mb-5 flex items-center justify-center">
                  <GraduationCap size={22} />
                </div>
                <h3 className="font-display text-lg font-bold mb-3 pr-12 text-brand">{c.title}</h3>
                <p className="text-sm text-muted-foreground mb-6">{c.desc}</p>
                <Link
                  to="/training"
                  className="inline-flex items-center justify-center gap-2 w-full text-center py-3 border border-brand text-brand font-bold text-xs uppercase tracking-widest hover:bg-brand hover:text-primary-foreground transition-all rounded-md"
                >
                  <CalendarClock size={14} /> Enroll Now
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7 · PROVIDER CTA — clean split */}
      <section className="bg-background border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-20 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3 text-accent-orange">
              04 — For Providers
            </p>
            <h2 className="font-display text-4xl lg:text-5xl font-extrabold tracking-tight text-brand">
              Scale your NEMT fleet.
            </h2>
            <p className="mt-4 text-muted-foreground text-lg max-w-[55ch]">
              Higher-volume medical contracts, dispatch tools, and a statewide referral network — all backed by HIPAA-grade infrastructure.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-3 text-sm text-foreground">
              {["Vetted patient leads", "Statewide referrals", "Stripe payouts (4% fee)", "Driver & fleet tools"].map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-accent-orange" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:col-span-5 flex lg:justify-end">
            <Link to="/providers" className="btn-accent">
              <Truck size={18} /> Register Your Fleet <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

    </>
  );
}


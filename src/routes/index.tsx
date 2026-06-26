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
      { title: "FloridaNEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Dignified, on-time non-emergency medical transportation across Florida. Ambulatory, wheelchair, and stretcher transport plus a provider network and training academy.",
      },
      { property: "og:title", content: "FloridaNEMT" },
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
      {/* Hero */}
      <section className="relative pt-20 pb-24 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-[11px] font-bold uppercase tracking-widest mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Statewide Coverage Across Florida
            </div>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter text-balance leading-[0.9] mb-8">
              Dignified transport
              <br />
              <span className="text-primary/40 italic font-medium">scheduled to the minute.</span>
            </h1>
            <p className="text-lg text-muted max-w-[50ch] text-pretty mb-10 leading-relaxed">
              Reliable non-emergency medical transportation for patients who value punctuality.
              Serving every major Florida hub with vetted providers and certified equipment.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/request-a-ride"
                className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-wide uppercase hover:translate-y-[-2px] transition-transform text-center"
              >
                Request a Ride
              </Link>
              <Link
                to="/providers"
                className="px-8 py-4 border-2 border-primary/10 text-primary font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-primary/5 transition-colors text-center"
              >
                Join the Provider Network
              </Link>
            </div>
          </div>
          <div className="animate-slide-up [animation-delay:200ms]">
            <div className="w-full aspect-[4/3] rounded-2xl overflow-hidden outline outline-1 -outline-offset-1 outline-black/5 shadow-2xl shadow-primary/10">
              <img
                src={heroVan}
                alt="Modern medical transport van outside a Florida clinic"
                width={1280}
                height={960}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="border-y border-border bg-card">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-wrap justify-center md:justify-between items-center gap-8">
          {trustItems.map(({ label, Icon }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <Icon size={20} strokeWidth={2.25} />
              </div>
              <span className="text-sm font-bold tracking-tight">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Services */}
      <section className="py-24 bg-card">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeading
            eyebrow="01 — Our Capabilities"
            title="Tailored Mobility Solutions"
            description="Specialized fleet configurations to support patients at every stage of their healthcare journey."
          />
          <div className="grid md:grid-cols-3 gap-8">
            {services.map((s) => (
              <div
                key={s.title}
                className="group p-8 rounded-xl bg-background border border-border hover:border-primary/20 transition-all"
              >
                <div className="size-12 bg-primary rounded-lg mb-6 group-hover:bg-accent transition-colors" />
                <h3 className="text-xl font-bold mb-3">{s.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link
              to="/services"
              className="font-bold text-primary underline underline-offset-8 hover:text-accent transition-colors text-sm uppercase tracking-wide"
            >
              Compare all service levels →
            </Link>
          </div>
        </div>
      </section>

      {/* Cities */}
      <section className="py-24 bg-primary text-primary-foreground overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
            <div>
              <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
                02 — Regional Reach
              </p>
              <h2 className="text-4xl font-extrabold tracking-tighter">Major Hub Coverage</h2>
            </div>
            <p className="text-white/60 max-w-[40ch] text-sm leading-relaxed pb-1">
              Operating statewide with 24/7 dispatch across Florida's primary medical corridors.
            </p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {cities.map((c) => (
              <Link
                key={c.slug}
                to="/service-areas/$city"
                params={{ city: c.slug }}
                className="aspect-square bg-white/5 border border-white/10 p-8 flex flex-col justify-between hover:bg-white/10 transition-colors group cursor-pointer"
              >
                <span className="font-mono text-xs text-white/40">{c.code}</span>
                <h4 className="text-2xl font-bold tracking-tight">{c.name}</h4>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Training academy */}
      <section className="py-24 bg-background">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-[1fr_2fr] gap-12 lg:gap-20">
            <div>
              <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
                03 — Career Development
              </p>
              <h2 className="text-4xl font-extrabold tracking-tighter mb-6">NEMT Training Academy</h2>
              <p className="text-muted text-sm leading-relaxed mb-8">
                Professionalize your transport career with our Florida-standard certification courses.
                Essential for all network providers.
              </p>
              <Link
                to="/training"
                className="font-bold text-primary underline underline-offset-8 hover:text-accent transition-colors"
              >
                View Curriculum →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 gap-8">
              {[
                { title: "Florida NEMT Basics", desc: "Comprehensive overview of state regulations, patient handling, and safety protocols." },
                { title: "HIPAA & Compliance", desc: "Privacy training specifically tailored for non-emergency medical drivers and dispatchers." },
              ].map((c) => (
                <div key={c.title} className="bg-card p-10 rounded-2xl shadow-sm border border-border relative overflow-hidden">
                  <div className="absolute top-0 right-0 px-4 py-1.5 bg-accent text-accent-foreground font-mono text-[10px] font-bold">
                    $100.00
                  </div>
                  <h3 className="text-lg font-bold mb-4 pr-12">{c.title}</h3>
                  <p className="text-sm text-muted mb-6">{c.desc}</p>
                  <Link
                    to="/training"
                    className="block w-full text-center py-3 border border-primary text-primary font-bold text-xs uppercase tracking-widest hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    Enroll Now
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Provider CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="bg-primary rounded-3xl p-12 lg:p-20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-12">
            <div className="relative z-10 text-center md:text-left">
              <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter text-primary-foreground mb-4">
                Scale your NEMT fleet.
              </h2>
              <p className="text-white/70 text-lg max-w-xl">
                Access higher-volume medical contracts, dispatch management tools, and a statewide
                referral network.
              </p>
            </div>
            <Link
              to="/providers"
              className="relative z-10 px-10 py-5 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-widest uppercase shadow-xl hover:scale-105 transition-transform"
            >
              Register Your Fleet
            </Link>
            <div
              className="absolute inset-0 bg-white/[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>
        </div>
      </section>
    </>
  );
}

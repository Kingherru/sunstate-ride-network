import { createFileRoute, Link } from "@tanstack/react-router";
import heroVan from "@/assets/hero-van.jpg";
import {
  ShieldCheck,
  BadgeCheck,
  Headphones,
  PersonStanding,
  Accessibility,
  BedDouble,
  MapPin,
  GraduationCap,
  Truck,
  ArrowRight,
  Building2,
  HeartPulse,
  Phone,
  Clock,
  CheckCircle2,
} from "lucide-react";

const cities = [
  { code: "JAX", name: "Jacksonville", slug: "jacksonville" },
  { code: "ORL", name: "Orlando", slug: "orlando" },
  { code: "TPA", name: "Tampa", slug: "tampa" },
  { code: "MIA", name: "Miami", slug: "miami" },
  { code: "TLH", name: "Tallahassee", slug: "tallahassee" },
  { code: "FLL", name: "Ft. Lauderdale", slug: "fort-lauderdale" },
  { code: "GNV", name: "Gainesville", slug: "gainesville" },
  { code: "DAB", name: "Daytona", slug: "daytona" },
] as const;

const services = [
  { title: "Ambulatory", Icon: PersonStanding, desc: "Door-to-door rides for independent patients who can walk with minimal help." },
  { title: "Wheelchair", Icon: Accessibility, desc: "ADA-equipped vehicles with lifts, four-point securement, and trained crews." },
  { title: "Stretcher", Icon: BedDouble, desc: "Bed-to-bed non-emergency transfers with trained attendants on every trip." },
] as const;

const portals = [
  { Icon: HeartPulse, label: "Patient", desc: "Book rides and manage appointments.", to: "/patient/login" as const },
  { Icon: Building2, label: "Facility", desc: "Dispatch from your clinic in seconds.", to: "/facility/login" as const },
  { Icon: Truck, label: "Provider", desc: "Receive referrals and grow your fleet.", to: "/provider/login" as const },
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Florida NEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Dignified, on-time non-emergency medical transportation across Florida. Ambulatory, wheelchair, and stretcher transport with a vetted statewide provider network.",
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
    <div className="bg-background">
      {/* ============ HERO ============ */}
      <section className="relative bg-brand text-primary-foreground overflow-hidden">
        <div className="absolute inset-0 reliability-grid opacity-20 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-20 lg:py-28 grid lg:grid-cols-12 gap-12 items-center relative">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold uppercase tracking-[0.16em] mb-6">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              Statewide · 24/7 Dispatch
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.02] mb-6">
              Florida's medical transportation,
              <span className="text-accent"> on time.</span>
            </h1>
            <p className="text-lg text-white/80 max-w-[55ch] leading-relaxed mb-8">
              One statewide network connecting patients, facilities, and vetted NEMT providers — ambulatory, wheelchair, and stretcher transport across all 67 counties.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/request-a-ride" className="btn-accent">
                Request a Ride <ArrowRight size={16} />
              </Link>
              <Link
                to="/providers"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[var(--radius)] bg-white/5 border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                <Truck size={16} /> Join Our Network
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70">
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-accent" /> HIPAA-grade</div>
              <div className="flex items-center gap-2"><BadgeCheck size={16} className="text-accent" /> Vetted providers</div>
              <div className="flex items-center gap-2"><Headphones size={16} className="text-accent" /> Live dispatch</div>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-[4/5] rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
              <img src={heroVan} alt="Florida NEMT van outside a clinic" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-brand/70 via-transparent to-transparent" />
              <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between text-white">
                <div>
                  <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent">In Service</div>
                  <div className="font-display text-xl font-bold">Florida Fleet</div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono bg-black/30 backdrop-blur px-2.5 py-1.5 rounded-full">
                  <span className="size-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ STATS STRIP ============ */}
      <section className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 divide-x divide-border">
          {[
            { value: "67", label: "Counties served" },
            { value: "24/7", label: "Live dispatch" },
            { value: "100%", label: "Vetted providers" },
            { value: "3", label: "Transport tiers" },
          ].map((s) => (
            <div key={s.label} className="py-8 px-4 text-center">
              <div className="font-display text-3xl sm:text-4xl font-extrabold text-brand leading-none">{s.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground font-semibold">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ============ SERVICES ============ */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="max-w-2xl mb-12">
            <span className="eyebrow">Services</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand mt-2 mb-3">Transportation for every level of care.</h2>
            <p className="text-muted-foreground">From routine dialysis runs to bed-to-bed transfers, our network handles every clinical need with dignity.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {services.map((s) => (
              <div key={s.title} className="group bg-card border border-border rounded-2xl p-7 hover:border-accent hover:-translate-y-0.5 transition-all">
                <div className="size-12 rounded-xl bg-brand/8 text-brand flex items-center justify-center mb-5 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                  <s.Icon size={24} strokeWidth={2} />
                </div>
                <h3 className="font-display text-xl font-bold text-brand mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{s.desc}</p>
                <Link to="/services" className="inline-flex items-center gap-1 text-xs font-semibold text-accent-orange uppercase tracking-wider">
                  Learn more <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section className="py-20 lg:py-24 bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <span className="eyebrow">How it works</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand mt-2 mb-4">Three steps to the curb.</h2>
            <p className="text-muted-foreground mb-6">Submit once. We handle the rest — matching, dispatch, and billing.</p>
            <Link to="/how-it-works" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-orange uppercase tracking-wider">
              Full walkthrough <ArrowRight size={14} />
            </Link>
          </div>
          <div className="lg:col-span-8 grid sm:grid-cols-3 gap-4">
            {[
              { n: "01", title: "Request", desc: "Tell us pickup, drop-off, and time — under 90 seconds." },
              { n: "02", title: "Match", desc: "We route to the closest vetted provider in your county." },
              { n: "03", title: "Ride", desc: "Driver arrives, ride is logged, and billing handled." },
            ].map((step) => (
              <div key={step.n} className="bg-card border border-border rounded-2xl p-6 flex flex-col">
                <div className="font-mono text-xs text-accent-orange font-bold tracking-[0.22em] mb-4">{step.n}</div>
                <div className="font-display text-lg font-bold text-brand mb-2">{step.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PORTALS ============ */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="eyebrow">Portals</span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand mt-2 mb-3">Built for everyone in the trip.</h2>
            <p className="text-muted-foreground">Patients, facilities, and providers each get their own workspace.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {portals.map((p) => (
              <Link
                key={p.label}
                to={p.to}
                className="group bg-card border border-border rounded-2xl p-7 hover:border-brand hover:shadow-lg transition-all"
              >
                <div className="size-12 rounded-xl bg-brand text-primary-foreground flex items-center justify-center mb-5">
                  <p.Icon size={22} />
                </div>
                <div className="font-display text-xl font-bold text-brand mb-1">{p.label} Portal</div>
                <p className="text-sm text-muted-foreground mb-5">{p.desc}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-orange uppercase tracking-wider">
                  Sign in <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COVERAGE ============ */}
      <section className="py-20 lg:py-24 bg-brand text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 reliability-grid opacity-15 pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase text-accent mb-2 block">Regional Reach</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-3">Major hubs, every coast.</h2>
              <p className="text-white/70">Coordinators on the ground in every metro — and routes that connect them.</p>
            </div>
            <Link to="/service-areas" className="inline-flex items-center gap-2 px-5 py-3 rounded-[var(--radius)] bg-white/10 border border-white/20 text-white font-semibold text-sm hover:bg-white/15 transition-colors self-start md:self-auto">
              All service areas <ArrowRight size={14} />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {cities.map((c) => (
              <Link
                key={c.slug}
                to="/service-areas/$city"
                params={{ city: c.slug }}
                className="group rounded-xl border border-white/15 p-4 hover:border-accent hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] text-white/50 tracking-widest">{c.code}</span>
                  <MapPin size={14} className="text-accent" />
                </div>
                <div className="font-display text-base font-bold">{c.name}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROVIDER CTA ============ */}
      <section className="py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center bg-card border border-border rounded-2xl p-8 lg:p-14">
            <div>
              <span className="eyebrow">For Providers</span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand mt-2 mb-4">Grow your NEMT business with us.</h2>
              <p className="text-muted-foreground mb-6">
                Join Florida's most active NEMT referral network. Verified leads, regional routing, integrated billing, and Stripe payouts — only a 4% platform fee on completed trips.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Referrals matched to your service zip codes",
                  "Insurance, NPI, and W-9 onboarding in one step",
                  "Stripe Connect — automated, secured payouts",
                  "Optional NEMT certification training",
                ].map((b) => (
                  <li key={b} className="flex gap-3 text-sm">
                    <CheckCircle2 size={18} className="text-accent-orange shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link to="/providers" className="btn-accent">
                  Apply to Join <ArrowRight size={16} />
                </Link>
                <Link to="/training" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[var(--radius)] border border-border text-brand font-semibold text-sm hover:bg-secondary transition-colors">
                  <GraduationCap size={16} /> NEMT Training
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { Icon: ShieldCheck, label: "HIPAA Ready", desc: "BAA on file." },
                { Icon: BadgeCheck, label: "Verified", desc: "Docs reviewed." },
                { Icon: Clock, label: "Fast Pay", desc: "Stripe payouts." },
                { Icon: Phone, label: "Support", desc: "Live coordinators." },
              ].map((b) => (
                <div key={b.label} className="bg-secondary/40 border border-border rounded-xl p-5">
                  <b.Icon size={22} className="text-accent-orange mb-3" />
                  <div className="font-display text-sm font-bold text-brand">{b.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{b.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FINAL CTA ============ */}
      <section className="py-16 bg-accent text-accent-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold mb-2">Need a ride today?</h2>
            <p className="text-sm opacity-80">Submit a request in under 90 seconds — we'll match a local provider.</p>
          </div>
          <Link
            to="/request-a-ride"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[var(--radius)] bg-brand text-primary-foreground font-bold text-sm uppercase tracking-wider hover:brightness-110 transition shrink-0"
          >
            Request a Ride <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    </div>
  );
}

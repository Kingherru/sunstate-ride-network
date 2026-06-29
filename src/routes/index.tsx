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
  CalendarClock,
  HeartPulse,
} from "lucide-react";

const cities = [
  { code: "JAX", name: "Jacksonville", slug: "jacksonville" },
  { code: "ORL", name: "Orlando", slug: "orlando" },
  { code: "TPA", name: "Tampa", slug: "tampa" },
  { code: "MIA", name: "Miami", slug: "miami" },
  { code: "TLH", name: "Tallahassee", slug: "tallahassee" },
  { code: "FLL", name: "Ft. Lauderdale", slug: "fort-lauderdale" },
] as const;

const services = [
  { title: "Ambulatory", Icon: PersonStanding, desc: "Door-to-door rides for independent patients." },
  { title: "Wheelchair", Icon: Accessibility, desc: "ADA lifts, four-point securement, trained crews." },
  { title: "Stretcher", Icon: BedDouble, desc: "Bed-to-bed non-emergency transfers." },
] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Florida NEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Dignified, on-time non-emergency medical transportation across Florida. Ambulatory, wheelchair, and stretcher transport with a statewide provider network.",
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
      {/* BENTO GRID — single unified canvas */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-6 auto-rows-[minmax(180px,auto)] gap-4">
          {/* HERO — spans 4 cols x 2 rows */}
          <div className="md:col-span-4 md:row-span-2 relative overflow-hidden rounded-2xl bg-brand text-primary-foreground p-8 lg:p-12 flex flex-col justify-between min-h-[480px]">
            <div className="absolute inset-0 reliability-grid opacity-30 pointer-events-none" />
            <div
              className="absolute -top-24 -right-24 h-96 w-96 rounded-full pointer-events-none"
              style={{ background: "radial-gradient(circle, var(--accent) 0%, transparent 65%)", opacity: 0.35 }}
            />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 text-[11px] font-semibold uppercase tracking-[0.16em] mb-6">
                <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                Statewide · 24/7 Dispatch
              </div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[0.98] mb-5">
                Florida's medical<br />transportation,
                <span className="text-accent"> on time.</span>
              </h1>
              <p className="text-base sm:text-lg text-white/75 max-w-[48ch] leading-relaxed">
                One statewide network connecting patients, facilities, and vetted NEMT providers — backed by HIPAA-grade dispatch.
              </p>
            </div>
            <div className="relative flex flex-col sm:flex-row gap-3 mt-8">
              <Link to="/request-a-ride" className="btn-accent">
                Request a Ride <ArrowRight size={16} />
              </Link>
              <Link
                to="/providers"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[var(--radius)] bg-white/5 border border-white/25 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                <Truck size={16} /> Join Network
              </Link>
            </div>
          </div>

          {/* HERO IMAGE — 2x2 */}
          <div className="md:col-span-2 md:row-span-2 relative overflow-hidden rounded-2xl min-h-[240px] md:min-h-[480px]">
            <img src={heroVan} alt="Florida NEMT van outside a clinic" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[oklch(0.22_0.07_250)]/80 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
              <div className="font-mono text-[10px] tracking-[0.2em] uppercase text-accent mb-1">In Service</div>
              <div className="font-display text-xl font-bold">Florida Fleet</div>
            </div>
          </div>

          {/* STAT 1 */}
          <div className="md:col-span-2 rounded-2xl bg-card border border-border p-6 flex flex-col justify-between">
            <span className="eyebrow">Coverage</span>
            <div>
              <div className="font-display text-5xl font-extrabold text-brand leading-none">67</div>
              <div className="mt-2 text-sm text-muted-foreground">Florida counties served, coast to coast.</div>
            </div>
          </div>

          {/* STAT 2 */}
          <div className="md:col-span-2 rounded-2xl bg-accent text-accent-foreground p-6 flex flex-col justify-between">
            <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase opacity-70">Dispatch</span>
            <div>
              <div className="font-display text-5xl font-extrabold leading-none">24 / 7</div>
              <div className="mt-2 text-sm opacity-80">Live coordinators every hour of the year.</div>
            </div>
          </div>

          {/* STAT 3 */}
          <div className="md:col-span-2 rounded-2xl bg-secondary text-secondary-foreground p-6 flex flex-col justify-between">
            <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase opacity-70">Vetted</span>
            <div>
              <div className="font-display text-5xl font-extrabold leading-none">100%</div>
              <div className="mt-2 text-sm opacity-80">Insurance · NPI · W-9 verified providers.</div>
            </div>
          </div>

          {/* SERVICES — 3 cards side by side, full width row */}
          {services.map((s) => (
            <div
              key={s.title}
              className="md:col-span-2 group rounded-2xl bg-card border border-border p-6 hover:border-accent transition-colors flex flex-col"
            >
              <div className="size-11 rounded-xl bg-brand/8 text-brand flex items-center justify-center mb-4 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                <s.Icon size={22} strokeWidth={2} />
              </div>
              <h3 className="font-display text-xl font-bold text-brand mb-1">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              <Link to="/services" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent-orange uppercase tracking-wider">
                Details <ArrowRight size={12} />
              </Link>
            </div>
          ))}

          {/* THREE PORTALS — featured 3x2 */}
          <div className="md:col-span-3 md:row-span-2 rounded-2xl bg-card border border-border p-8 flex flex-col">
            <span className="eyebrow mb-4">Built for everyone</span>
            <h2 className="font-display text-3xl font-extrabold text-brand mb-2">Three portals. One network.</h2>
            <p className="text-sm text-muted-foreground mb-6">Patients, facilities, and providers each get tools built for their workflow.</p>
            <div className="grid gap-3 flex-1">
              {[
                { Icon: HeartPulse, label: "Patient", desc: "Book rides, manage trips, save preferences.", to: "/patient/login" as const },
                { Icon: Building2, label: "Facility", desc: "Dispatch from clinics, save patients & cards.", to: "/facility/login" as const },
                { Icon: Truck, label: "Provider", desc: "Receive referrals, manage fleet & payouts.", to: "/provider/login" as const },
              ].map((p) => (
                <Link
                  key={p.label}
                  to={p.to}
                  className="group flex items-center gap-4 p-4 rounded-xl border border-border hover:border-brand hover:bg-secondary/30 transition-colors"
                >
                  <div className="size-10 rounded-lg bg-brand text-primary-foreground flex items-center justify-center shrink-0">
                    <p.Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-bold text-brand">{p.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{p.desc}</div>
                  </div>
                  <ArrowRight size={16} className="text-muted-foreground group-hover:text-brand transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* TRUST */}
          <div className="md:col-span-3 rounded-2xl bg-brand text-primary-foreground p-6 flex flex-col justify-center">
            <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase text-accent mb-4">Trust Signals</span>
            <div className="grid grid-cols-3 gap-3">
              {[
                { Icon: ShieldCheck, label: "HIPAA" },
                { Icon: BadgeCheck, label: "Insured" },
                { Icon: Headphones, label: "24/7" },
              ].map((t) => (
                <div key={t.label} className="flex flex-col items-start gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                  <t.Icon size={20} className="text-accent" strokeWidth={2.25} />
                  <span className="text-xs font-semibold tracking-tight">{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* TRAINING CTA */}
          <div className="md:col-span-3 rounded-2xl bg-secondary text-secondary-foreground p-6 flex flex-col justify-between min-h-[200px]">
            <div>
              <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase opacity-70 mb-3 block">Academy</span>
              <h3 className="font-display text-2xl font-extrabold mb-1">NEMT Training</h3>
              <p className="text-sm opacity-80 max-w-[40ch]">State-standard certification — required for network providers, open to the public.</p>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                <GraduationCap size={16} /> $100 per course
              </div>
              <Link to="/training" className="inline-flex items-center gap-1 text-sm font-semibold">
                Enroll <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* COVERAGE — 6 city tiles in 2 rows */}
          <div className="md:col-span-6 rounded-2xl bg-card border border-border p-6">
            <div className="flex items-end justify-between mb-5">
              <div>
                <span className="eyebrow">Regional Reach</span>
                <h3 className="font-display text-2xl font-extrabold text-brand mt-1">Major hub coverage</h3>
              </div>
              <Link to="/service-areas" className="text-xs font-semibold text-accent-orange uppercase tracking-wider inline-flex items-center gap-1">
                All areas <ArrowRight size={12} />
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {cities.map((c) => (
                <Link
                  key={c.slug}
                  to="/service-areas/$city"
                  params={{ city: c.slug }}
                  className="group rounded-xl border border-border p-4 hover:border-accent hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-[10px] text-muted-foreground tracking-widest">{c.code}</span>
                    <MapPin size={14} className="text-accent-orange" />
                  </div>
                  <div className="font-display text-sm font-bold text-brand">{c.name}</div>
                </Link>
              ))}
            </div>
          </div>

          {/* PROVIDER CTA — full width band */}
          <div className="md:col-span-6 rounded-2xl bg-accent text-accent-foreground p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="max-w-xl">
              <span className="font-mono text-[10px] font-bold tracking-[0.22em] uppercase opacity-70 mb-2 block">For Providers</span>
              <h3 className="font-display text-3xl font-extrabold mb-2">Scale your NEMT fleet.</h3>
              <p className="text-sm opacity-80">Higher-volume medical contracts, referral routing, and Stripe payouts — 4% platform fee.</p>
            </div>
            <Link
              to="/providers"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[var(--radius)] bg-brand text-primary-foreground font-bold text-sm uppercase tracking-wider hover:brightness-110 transition shrink-0"
            >
              <Truck size={16} /> Register Fleet <ArrowRight size={14} />
            </Link>
          </div>

          {/* QUICK BOOK */}
          <div className="md:col-span-3 rounded-2xl bg-brand text-primary-foreground p-6 flex flex-col justify-between">
            <div>
              <CalendarClock size={24} className="text-accent mb-3" />
              <h3 className="font-display text-xl font-extrabold mb-1">Need a ride today?</h3>
              <p className="text-sm text-white/70">Submit a request in under 90 seconds — we route it to the closest vetted provider.</p>
            </div>
            <Link to="/request-a-ride" className="mt-5 btn-accent">
              Request a Ride <ArrowRight size={14} />
            </Link>
          </div>

          {/* HOW IT WORKS */}
          <div className="md:col-span-3 rounded-2xl bg-card border border-border p-6 flex flex-col justify-between">
            <div>
              <span className="eyebrow">How it works</span>
              <ol className="mt-4 space-y-3">
                {[
                  "Tell us pickup, drop-off & time",
                  "We match a vetted local provider",
                  "Driver arrives, ride is logged & billed",
                ].map((step, i) => (
                  <li key={step} className="flex gap-3 text-sm">
                    <span className="size-6 rounded-full bg-brand text-primary-foreground font-mono text-xs flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Link to="/how-it-works" className="mt-5 text-xs font-semibold text-accent-orange uppercase tracking-wider inline-flex items-center gap-1">
              Full walkthrough <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

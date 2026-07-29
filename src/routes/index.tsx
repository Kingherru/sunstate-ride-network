import { createFileRoute, Link } from "@tanstack/react-router";
import heroVan from "@/assets/hero-van.jpg";
import { ArrowRight, Phone, Clock, Shield, MapPin } from "lucide-react";
import { CITY_LIST } from "@/lib/cities";

// Brand palette — matches the admin platform_theme (navy + orange).
// Do NOT swap these for off-brand pastels; the whole page reads from them.
const NAVY = "#13335a";      // primary
const ORANGE = "#e07a1f";    // accent
const PEACH = ORANGE;        // legacy alias — keeps all downstream styles on-brand
const MINT = "#FFF3E4";      // soft orange-tinted neutral for card variety
const CORAL = ORANGE;        // legacy alias
const CREAM = "#FFF8EE";     // warm cream neutral

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Florida NEMT — Statewide NEMT Network" },
      { name: "description", content: "Non-emergency medical transportation across all 67 Florida counties. Ambulatory, wheelchair, and stretcher trips 24/7." },
      { property: "og:title", content: "My Florida NEMT — Statewide NEMT Network" },
      { property: "og:description", content: "Ambulatory, wheelchair, and stretcher medical transport across all 67 Florida counties." },
      { property: "og:url", content: "https://myfloridanemt.com/" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="bg-white" style={{ color: NAVY }}>
      {/* ============ HERO (kept) — full-bleed, no image overlay ============ */}
      <section
        className="grid lg:grid-cols-2 min-h-[88vh]"
        style={{ borderBottom: `1px solid ${NAVY}` }}
      >
        <div className="p-10 lg:p-24 flex flex-col justify-center">
          <span
            className="font-mono text-xs font-bold uppercase tracking-[0.28em] mb-6"
            style={{ color: CORAL }}
          >
            Statewide · 67 Counties · 24/7
          </span>
          <h1
            className="font-display text-5xl lg:text-7xl font-bold leading-[1.02] mb-6"
            style={{ color: NAVY }}
          >
            Reliable Medical Transport{" "}
            <span
              className="underline underline-offset-8"
              style={{ color: PEACH, textDecorationColor: PEACH, textDecorationThickness: 4 }}
            >
              Across Florida.
            </span>
          </h1>
          <p className="text-lg mb-10 max-w-md" style={{ color: `${NAVY}cc` }}>
            Connecting Medicaid members with specialized transportation services in every county,
            from the Panhandle to the Keys.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/request-a-ride"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2 transition-colors inline-flex items-center gap-2"
              style={{ background: PEACH, borderColor: PEACH, color: NAVY }}
            >
              Request a Ride <ArrowRight size={18} />
            </Link>
            <Link
              to="/provider/login"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2 transition-colors inline-flex items-center gap-2"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Provider Sign In
            </Link>
          </div>
        </div>

        {/* Clean image — no overlay */}
        <div className="relative min-h-[400px] overflow-hidden bg-slate-100">
          <img
            src={heroVan}
            alt="My Florida NEMT van outside a clinic"
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
      </section>

      {/* ============ COLOR TRUST BAR ============ */}
      <section className="grid grid-cols-2 md:grid-cols-4">
        {[
          { icon: <MapPin size={20} />, value: "67", label: "Counties", bg: PEACH, fg: NAVY },
          { icon: <Clock size={20} />, value: "24/7", label: "Dispatch", bg: MINT, fg: NAVY },
          { icon: <Shield size={20} />, value: "100%", label: "HIPAA Compliant", bg: "#FFFFFF", fg: NAVY },
          { icon: <Phone size={20} />, value: "3,500+", label: "Daily Trips", bg: CREAM, fg: NAVY },
        ].map((s) => (
          <div key={s.label} className="px-6 py-10 flex items-center gap-4" style={{ background: s.bg, color: s.fg }}>
            <div className="opacity-80">{s.icon}</div>
            <div>
              <div className="font-display font-bold text-3xl leading-none">{s.value}</div>
              <div className="uppercase tracking-widest text-[10px] font-bold mt-1 opacity-85">{s.label}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ============ MERGED: PORTALS + SERVICES — one header, two subheaders ============ */}
      <section className="px-6 py-20 lg:py-28" style={{ background: "#FFFFFF" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-14 max-w-3xl">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: CORAL }}>
              The Platform
            </p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight" style={{ color: NAVY }}>
              Built for every side of the trip — and every level of mobility.
            </h2>
          </div>

          {/* Sub-section 1: Portals */}
          <div className="mb-16">
            <h3 className="font-display font-bold text-2xl lg:text-3xl mb-8" style={{ color: NAVY }}>
              Three portals, one network.
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: "01", label: "For Patients", desc: "Book scheduled medical appointments and track your driver.", cta: "Patient Portal", to: "/patient/login" as const, color: MINT },
                { n: "02", label: "For Facilities", desc: "Manage discharges and recurring trips for an entire resident population.", cta: "Facility Dashboard", to: "/facility/login" as const, color: PEACH },
                { n: "03", label: "For Providers", desc: "Access the trip marketplace, manage your fleet, and streamline billing.", cta: "Provider Network", to: "/provider/login" as const, color: CORAL },
              ].map((p) => (
                <Link
                  key={p.label}
                  to={p.to}
                  className="group p-8 rounded-[1rem] bg-white transition-all hover:-translate-y-1 hover:shadow-xl border"
                  style={{ borderColor: `${NAVY}1f` }}
                >
                  <div
                    className="w-14 h-14 rounded-full mb-6 flex items-center justify-center font-bold font-display text-lg"
                    style={{ background: p.color, color: NAVY }}
                  >
                    {p.n}
                  </div>
                  <h4 className="text-2xl font-bold font-display mb-3" style={{ color: NAVY }}>{p.label}</h4>
                  <p className="mb-6 text-sm" style={{ color: `${NAVY}b3` }}>{p.desc}</p>
                  <span className="font-bold inline-flex items-center gap-2 group-hover:gap-3 transition-all" style={{ color: NAVY }}>
                    {p.cta} <ArrowRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* Sub-section 2: Specialized fleet */}
          <div>
            <h3 className="font-display font-bold text-2xl lg:text-3xl mb-8" style={{ color: NAVY }}>
              Specialized fleet for every mobility level.
            </h3>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { n: "01", label: "Ambulatory", desc: "Patients who walk independently or with minor assistance.", cta: "Explore ambulatory services", to: "/services/ambulatory" as const, color: MINT },
                { n: "02", label: "Wheelchair", desc: "Hydraulic lifts or ramps for safe manual & power chair transport.", cta: "View wheelchair transport details", to: "/services/wheelchair" as const, color: PEACH },
                { n: "03", label: "Stretcher", desc: "Non-emergency gurney transport for bed-confined patients.", cta: "See stretcher transport options", to: "/services/stretcher" as const, color: CORAL },
              ].map((svc) => (
                <Link
                  key={svc.label}
                  to={svc.to}
                  className="group p-8 rounded-[1rem] bg-white transition-all hover:-translate-y-1 hover:shadow-xl border"
                  style={{ borderColor: `${NAVY}1f` }}
                >
                  <div
                    className="w-14 h-14 rounded-full mb-6 flex items-center justify-center font-bold font-display text-lg"
                    style={{ background: svc.color, color: NAVY }}
                  >
                    {svc.n}
                  </div>
                  <h4 className="text-2xl font-bold font-display mb-3" style={{ color: NAVY }}>{svc.label}</h4>
                  <p className="mb-6 text-sm" style={{ color: `${NAVY}b3` }}>{svc.desc}</p>
                  <span className="font-bold inline-flex items-center gap-2 group-hover:gap-3 transition-all" style={{ color: NAVY }}>
                    {svc.cta} <ArrowRight size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ============ LOCATION BLOCKS — service-areas style ============ */}
      <section className="px-6 py-20 lg:py-28" style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: PEACH }}>
                Statewide Coverage
              </p>
              <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight">
                Pick your region.
              </h2>
            </div>
            <Link
              to="/service-areas"
              className="font-bold inline-flex items-center gap-2 text-sm uppercase tracking-wider"
              style={{ color: PEACH }}
            >
              All service areas <ArrowRight size={14} />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {CITY_LIST.map((c) => (
              <Link
                key={c.slug}
                to="/service-areas/$city"
                params={{ city: c.slug }}
                className="group bg-white/[0.04] border border-white/[0.08] rounded-xl p-8 hover:bg-white/[0.08] hover:border-white/20 transition-all"
              >
                <div className="flex items-start justify-between mb-8">
                  <span className="font-mono text-xs text-white/85">{c.code}</span>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-white/85">
                    {c.region}
                  </span>
                </div>
                <h3 className="text-3xl font-extrabold tracking-tight mb-3 text-white">{c.name}</h3>
                <p className="text-sm text-white/85 leading-relaxed mb-6">{c.blurb}</p>
                <span className="text-xs font-bold uppercase tracking-widest group-hover:underline" style={{ color: PEACH }}>
                  View coverage →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ HOW IT WORKS — peach band ============ */}
      <section className="px-6 py-20 lg:py-28" style={{ background: NAVY }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: CORAL }}>
              The Process
            </p>
            <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight text-white">
              From submission to safe arrival.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Submit", desc: "Patients or facilities enter pickup, drop-off, and medical needs in under 90 seconds." },
              { n: "02", title: "Match", desc: "We route the trip to the closest vetted provider in the patient's county." },
              { n: "03", title: "Ride", desc: "Driver arrives, ride is logged, and payment flows automatically through the platform." },
            ].map((step) => (
              <div key={step.n} className="p-8 rounded-[1rem] bg-white">
                <div className="font-mono font-bold text-sm tracking-[0.22em] mb-4" style={{ color: CORAL }}>
                  {step.n}
                </div>
                <h3 className="text-2xl font-bold font-display mb-2" style={{ color: NAVY }}>{step.title}</h3>
                <p className="text-sm" style={{ color: `${NAVY}b3` }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ TRAINING & CERTIFICATION ============ */}
      <section className="px-6 py-20 lg:py-28 bg-white" style={{ borderTop: `0.5px solid ${NAVY}12` }}>
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3" style={{ color: CORAL }}>
                Training & Certification
              </p>
              <h2 className="font-display font-bold text-4xl lg:text-5xl tracking-tight" style={{ color: NAVY }}>
                Get certified. No account required.
              </h2>
              <p className="mt-3 text-base max-w-xl" style={{ color: `${NAVY}b3` }}>
                Online HIPAA and Florida NEMT certification courses for drivers, dispatchers, and staff.
                Purchase, take the exam, and download your certificate — creating an account is recommended
                so your progress and certificate are saved.
              </p>
            </div>
            <Link
              to="/shop"
              className="font-bold px-6 py-3 rounded-[0.75rem] border-2 inline-flex items-center gap-2"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Browse all courses <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { slug: "hipaa", title: "HIPAA Training for NEMT", desc: "Compliance essentials for NEMT drivers, dispatchers, and office staff." },
              { slug: "nemt-certification", title: "Florida NEMT Certification", desc: "Statewide NEMT operating standards, safety, and passenger care." },
            ].map((c) => (
              <Link
                key={c.slug}
                to="/shop/$slug"
                params={{ slug: c.slug }}
                className="group p-8 rounded-[1rem] border-2 flex flex-col"
                style={{ borderColor: `${NAVY}22`, background: CREAM }}
              >
                <div className="font-mono text-xs font-bold uppercase tracking-widest mb-3" style={{ color: CORAL }}>
                  Online course · Certificate
                </div>
                <h3 className="font-display font-bold text-2xl mb-2" style={{ color: NAVY }}>{c.title}</h3>
                <p className="text-sm mb-6 flex-1" style={{ color: `${NAVY}b3` }}>{c.desc}</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold" style={{ color: NAVY }}>$50</span>
                  <span className="text-xs font-bold uppercase tracking-widest group-hover:underline" style={{ color: CORAL }}>
                    Enroll now →
                  </span>
                </div>
              </Link>
            ))}
          </div>
          <p className="mt-6 text-[11px] italic" style={{ color: `${NAVY}88` }}>
            Pricing is subject to change at any time.
          </p>
        </div>
      </section>

      {/* ============ CTA ============ */}
      <section className="px-6 py-20 lg:py-28 text-center" style={{ background: CREAM }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="font-display font-bold text-4xl lg:text-6xl tracking-tight mb-6" style={{ color: NAVY }}>
            Ready to coordinate your next trip?
          </h2>
          <p className="mb-10 text-lg" style={{ color: `${NAVY}99` }}>
            Submit a ride request in under 90 seconds — we'll match a vetted local provider in
            your county.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/request-a-ride"
              className="font-bold px-10 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ background: CORAL, borderColor: CORAL, color: "#fff" }}
            >
              Get Started Now <ArrowRight size={18} />
            </Link>
            <Link
              to="/how-it-works"
              className="font-bold px-10 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              How it works
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

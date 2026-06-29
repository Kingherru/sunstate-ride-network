import { createFileRoute, Link } from "@tanstack/react-router";
import heroVan from "@/assets/hero-van.jpg";
import { ArrowRight } from "lucide-react";

const NAVY = "#1D3557";
const PEACH = "#F9CB9F";

const portals = [
  {
    n: "01",
    label: "For Patients",
    desc: "Book your scheduled medical appointments and track your driver in real-time.",
    cta: "Patient Portal",
    to: "/patient/login" as const,
  },
  {
    n: "02",
    label: "For Facilities",
    desc: "Manage discharges and recurring appointments for your entire resident population.",
    cta: "Facility Dashboard",
    to: "/facility/login" as const,
  },
  {
    n: "03",
    label: "For Providers",
    desc: "Access the trip marketplace, manage your fleet, and streamline medical billing.",
    cta: "Provider Network",
    to: "/provider/login" as const,
  },
];

const services = [
  { title: "Ambulatory", desc: "For patients who can walk independently or with minor assistance from a driver." },
  { title: "Wheelchair", desc: "Equipped with hydraulic lifts or ramps for safe, secure transport of manual or power chairs.", tinted: true },
  { title: "Stretcher", desc: "Non-emergency gurney transport for bed-confined patients needing specialized positioning." },
];

const stats = [
  { value: "67", label: "Counties Covered" },
  { value: "24/7", label: "Dispatch Available" },
  { value: "100%", label: "HIPAA Compliant" },
  { value: "3,500+", label: "Daily Trips" },
];

const regions = [
  "Jacksonville", "Orlando", "Tampa Bay", "Miami-Dade",
  "Gainesville", "Daytona Beach", "SW Florida", "Tallahassee",
  "Pensacola", "Palm Beach", "Space Coast", "Florida Keys",
];

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Florida NEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Reliable Medicaid non-emergency medical transportation across Florida. Ambulatory, wheelchair, and stretcher transport with a vetted statewide provider network.",
      },
      { property: "og:title", content: "Florida NEMT — Statewide Medical Transportation" },
      { property: "og:description", content: "Reliable Medicaid NEMT across all 67 Florida counties." },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return (
    <div className="bg-white" style={{ color: NAVY }}>
      <div className="max-w-6xl mx-auto my-8 lg:my-12 bg-white overflow-hidden shadow-sm">

        {/* ============ HERO — split composition ============ */}
        <section
          className="grid lg:grid-cols-2"
          style={{ borderBottom: `1px solid ${NAVY}` }}
        >
          <div className="p-10 lg:p-20 flex flex-col justify-center">
            <h1
              className="font-display text-5xl lg:text-6xl font-bold leading-[1.05] mb-6"
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
                className="font-bold px-8 py-4 rounded-[0.875rem] border-2 transition-colors hover:text-white inline-flex items-center gap-2"
                style={{ borderColor: NAVY, color: NAVY }}
                onMouseEnter={(e) => (e.currentTarget.style.background = NAVY)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                Provider Sign In
              </Link>
            </div>
          </div>

          <div
            className="relative min-h-[400px] flex items-center justify-center overflow-hidden"
            style={{ background: NAVY }}
          >
            <div
              className="absolute inset-8 lg:inset-12 rounded-[0.875rem] opacity-30"
              style={{ border: `2px solid ${PEACH}` }}
            />
            <img
              src={heroVan}
              alt="Florida NEMT van outside a clinic"
              className="absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div className="relative z-10 text-center">
              <div
                className="text-[10rem] lg:text-[14rem] font-bold leading-none font-display opacity-20"
                style={{ color: PEACH }}
              >
                FL
              </div>
              <div
                className="font-mono text-xs uppercase tracking-[0.3em] mt-2"
                style={{ color: PEACH }}
              >
                Statewide · 24/7
              </div>
            </div>
          </div>
        </section>

        {/* ============ TRUST STRIP ============ */}
        <div
          className="py-6 px-8 lg:px-12 flex flex-wrap justify-between items-center gap-x-8 gap-y-4"
          style={{ background: PEACH }}
        >
          {stats.map((s) => (
            <div key={s.label} className="flex items-center gap-3">
              <span className="font-bold text-xl font-display" style={{ color: NAVY }}>
                {s.value}
              </span>
              <span
                className="uppercase tracking-widest text-[10px] font-bold"
                style={{ color: `${NAVY}b3` }}
              >
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ============ PORTAL CARDS ============ */}
        <section className="p-10 lg:p-20 grid md:grid-cols-3 gap-6 lg:gap-8" style={{ background: "#fdfdfd" }}>
          {portals.map((p) => (
            <Link
              key={p.label}
              to={p.to}
              className="group p-8 rounded-[0.875rem] transition-all duration-300 hover:shadow-elegant"
              style={{ border: `2px solid ${NAVY}` }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = NAVY;
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = NAVY;
              }}
            >
              <div
                className="w-12 h-12 rounded-full mb-6 flex items-center justify-center font-bold font-display"
                style={{ background: PEACH, color: NAVY }}
              >
                {p.n}
              </div>
              <h3 className="text-2xl font-bold font-display mb-4">{p.label}</h3>
              <p className="mb-6 transition-colors" style={{ opacity: 0.8 }}>
                {p.desc}
              </p>
              <span className="font-bold inline-flex items-center gap-2 group-hover:gap-3 transition-all">
                {p.cta} <ArrowRight size={16} />
              </span>
            </Link>
          ))}
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section className="p-10 lg:p-20" style={{ borderTop: `1px solid ${NAVY}1a` }}>
          <div className="mb-10">
            <h2 className="text-3xl font-bold font-display mb-2" style={{ color: NAVY }}>
              How a trip moves through Florida NEMT
            </h2>
            <p style={{ color: `${NAVY}99` }}>From submission to safe arrival — three coordinated steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "01", title: "Submit", desc: "Patients or facilities enter pickup, drop-off, and medical needs in under 90 seconds." },
              { n: "02", title: "Match", desc: "We route the trip to the closest vetted provider in the patient's county." },
              { n: "03", title: "Ride", desc: "Driver arrives, ride is logged, and payment flows automatically through the platform." },
            ].map((step) => (
              <div key={step.n} className="p-8 rounded-[0.875rem]" style={{ border: `2px solid ${NAVY}1a` }}>
                <div className="font-mono font-bold text-sm tracking-[0.22em] mb-4" style={{ color: PEACH }}>
                  {step.n}
                </div>
                <h4 className="text-xl font-bold font-display mb-2" style={{ color: NAVY }}>{step.title}</h4>
                <p className="text-sm" style={{ color: `${NAVY}b3` }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ SERVICES — bordered grid ============ */}
        <section className="p-10 lg:p-20" style={{ borderTop: `1px solid ${NAVY}1a` }}>
          <div className="mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h2 className="text-3xl font-bold font-display mb-2" style={{ color: NAVY }}>
                Specialized Fleet Services
              </h2>
              <p style={{ color: `${NAVY}99` }}>Tailored transportation for every mobility level.</p>
            </div>
            <Link
              to="/services"
              className="font-bold inline-flex items-center gap-2 text-sm uppercase tracking-wider"
              style={{ color: NAVY }}
            >
              All services <ArrowRight size={14} />
            </Link>
          </div>
          <div
            className="grid md:grid-cols-3 gap-0 rounded-[0.875rem] overflow-hidden"
            style={{ border: `2px solid ${NAVY}` }}
          >
            {services.map((svc, i) => (
              <div
                key={svc.title}
                className="p-10"
                style={{
                  background: svc.tinted ? `${PEACH}1a` : "white",
                  borderRight: i < services.length - 1 ? `2px solid ${NAVY}` : "none",
                }}
              >
                <h4 className="font-bold text-xl font-display mb-3" style={{ color: NAVY }}>
                  {svc.title}
                </h4>
                <p className="text-sm" style={{ color: `${NAVY}b3` }}>{svc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ============ COVERAGE — navy band ============ */}
        <section className="p-10 lg:p-20 text-white" style={{ background: NAVY }}>
          <div className="grid lg:grid-cols-4 gap-10">
            <div className="lg:col-span-1">
              <h2 className="text-3xl font-bold font-display mb-6">Statewide Coverage</h2>
              <p className="text-sm leading-relaxed mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
                Operating one of the largest coordinated NEMT networks in Florida with localized
                dispatch centers in every major metro.
              </p>
              <div className="w-16 h-1" style={{ background: PEACH }} />
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4">
                {regions.map((r) => (
                  <Link
                    key={r}
                    to="/service-areas"
                    className="pb-2 border-b transition-colors hover:text-white"
                    style={{
                      color: "rgba(255,255,255,0.8)",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = PEACH)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(255,255,255,0.8)")}
                  >
                    {r}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============ CTA BAND ============ */}
        <section className="p-10 lg:p-16 text-center" style={{ borderTop: `1px solid ${NAVY}` }}>
          <h2 className="text-3xl font-bold font-display mb-6" style={{ color: NAVY }}>
            Ready to coordinate your next trip?
          </h2>
          <p className="mb-8 max-w-xl mx-auto" style={{ color: `${NAVY}99` }}>
            Submit a ride request in under 90 seconds — we'll match a vetted local provider in
            your county.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/request-a-ride"
              className="font-bold px-10 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ background: PEACH, borderColor: PEACH, color: NAVY }}
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
        </section>

      </div>
    </div>
  );
}

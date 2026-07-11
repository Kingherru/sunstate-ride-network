import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, PersonStanding } from "lucide-react";
import { buildServiceSchema } from "@/lib/schema";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

const NAVY = "#13335a";
const ORANGE = "#e07a1f";
const MINT = "#FFF3E4";
const CREAM = "#FFF8EE";

const TITLE = "Ambulatory Transportation Services in Florida | Safe Medical Transportation";
const DESCRIPTION =
  "Reliable ambulatory transportation throughout Florida for patients who can walk independently or need minimal assistance. Our NEMT providers offer safe, professional transportation to medical appointments, healthcare facilities, and treatment centers.";
const URL = "https://myfloridanemt.com/services/ambulatory";

export const Route = createFileRoute("/services/ambulatory")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildServiceSchema({
            name: "Ambulatory Transportation Services",
            serviceType: "Ambulatory Non-Emergency Medical Transportation",
            description: DESCRIPTION,
            url: URL,
          })
        ),
      },
    ],
  }),
  component: AmbulatoryPage,
});

function AmbulatoryPage() {
  return (
    <ServiceLayout
      breadcrumbs={[
        { label: "Services", to: "/services" },
        { label: "Ambulatory Transportation" },
      ]}
      eyebrow="Curb-to-curb & door-to-door"
      title="Ambulatory Transportation"
      lede="Ambulatory transportation provides safe and reliable non-emergency medical transportation for passengers who can walk independently or need minimal assistance. Florida NEMT providers help patients travel comfortably to doctor appointments, dialysis, therapy, hospitals, and other healthcare services while receiving professional and dependable support."
      icon={<PersonStanding size={28} />}
      bullets={[
        "Safe, reliable rides for passengers who walk independently or need minimal assistance",
        "Professional, courteous drivers trained in patient assistance and HIPAA compliance",
        "On-time pickups for doctor visits, dialysis, therapy, and hospital appointments",
        "Statewide coverage across all 67 Florida counties, 24/7 dispatch",
      ]}
      relatedLinks={[
        { to: "/services/wheelchair", label: "Wheelchair Transportation", desc: "ADA-compliant lift-equipped vans for wheelchair passengers." },
        { to: "/services/stretcher", label: "Gurney & Stretcher Transportation", desc: "Bed-to-bed transport for patients who cannot travel seated." },
      ]}
      useCases={[
        { h: "Doctor visits", p: "Routine primary care, specialist consults, and follow-ups." },
        { h: "Dialysis rounds", p: "Recurring 3x-weekly transports coordinated as a standing schedule." },
        { h: "Hospital discharge", p: "Same-day pickups when a bed is needed." },
        { h: "Rehab & therapy", p: "Physical therapy, behavioral health, and pain management." },
      ]}
    />
  );
}


// --- shared layout used by all three service pages ---
export function ServiceLayout({
  breadcrumbs,
  eyebrow,
  title,
  lede,
  icon,
  bullets,
  relatedLinks,
  useCases,
}: {
  breadcrumbs: { label: string; to?: string }[];
  eyebrow: string;
  title: string;
  lede: string;
  icon: React.ReactNode;
  bullets: string[];
  relatedLinks?: { to: string; label: string; desc: string }[];
  useCases: { h: string; p: string }[];
}) {
  return (
    <div className="bg-white" style={{ color: NAVY }}>
      {/* Hero */}
      <section
        className="px-6 py-20 lg:py-28"
        style={{ background: CREAM, borderBottom: `1px solid ${NAVY}` }}
      >
        <div className="max-w-5xl mx-auto">
          <Breadcrumbs items={breadcrumbs} />
          <div
            className="w-16 h-16 rounded-2xl mt-8 mb-8 flex items-center justify-center"
            style={{ background: ORANGE, color: NAVY }}
          >
            {icon}
          </div>
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.28em] mb-4"
            style={{ color: ORANGE }}
          >
            {eyebrow}
          </p>
          <h1
            className="font-display text-5xl lg:text-6xl font-bold leading-[1.05] mb-6"
            style={{ color: NAVY }}
          >
            {title}
          </h1>
          <p className="text-lg max-w-2xl leading-relaxed" style={{ color: `${NAVY}cc` }}>
            {lede}
          </p>
          <div className="flex flex-wrap gap-4 mt-10">
            <Link
              to="/request-a-ride"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ background: ORANGE, borderColor: ORANGE, color: NAVY }}
            >
              Request a Ride <ArrowRight size={18} />
            </Link>
            <Link
              to="/contact"
              className="font-bold px-8 py-4 rounded-[0.875rem] border-2 inline-flex items-center gap-2"
              style={{ borderColor: NAVY, color: NAVY }}
            >
              Talk to Dispatch
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-5xl mx-auto">
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3"
            style={{ color: ORANGE }}
          >
            Benefits
          </p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-10" style={{ color: NAVY }}>
            Why patients and providers choose My Florida NEMT.
          </h2>
          <ul className="grid md:grid-cols-2 gap-6">
            {bullets.map((b) => (
              <li key={b} className="flex gap-4 p-6 rounded-[1rem]" style={{ background: MINT }}>
                <Check size={24} style={{ color: ORANGE }} className="shrink-0 mt-0.5" />
                <span className="text-base" style={{ color: NAVY }}>
                  {b}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Use cases */}
      <section className="px-6 py-20 lg:py-24" style={{ background: CREAM }}>
        <div className="max-w-5xl mx-auto">
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3"
            style={{ color: ORANGE }}
          >
            Common Trip Types
          </p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-10" style={{ color: NAVY }}>
            What we book, every day.
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {useCases.map((u) => (
              <div key={u.h} className="p-8 rounded-[1rem] bg-white border" style={{ borderColor: `${NAVY}1f` }}>
                <h3 className="font-display font-bold text-xl mb-3" style={{ color: NAVY }}>
                  {u.h}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                  {u.p}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Related services + internal links */}
      <section className="px-6 py-20 lg:py-24" style={{ background: MINT }}>
        <div className="max-w-5xl mx-auto">
          <p
            className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-3"
            style={{ color: ORANGE }}
          >
            Related Services
          </p>
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-10" style={{ color: NAVY }}>
            Not the right level of care?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Link
              to="/services/wheelchair"
              className="p-8 rounded-[1rem] bg-white border hover:border-accent transition-colors"
              style={{ borderColor: `${NAVY}1f` }}
            >
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: NAVY }}>
                Wheelchair Transportation
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                ADA-compliant lift-equipped vans for passengers who remain in their wheelchair during travel.
              </p>
            </Link>
            <Link
              to="/services/stretcher"
              className="p-8 rounded-[1rem] bg-white border hover:border-accent transition-colors"
              style={{ borderColor: `${NAVY}1f` }}
            >
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: NAVY }}>
                Gurney & Stretcher Transportation
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                Bed-to-bed non-emergency transport for patients who cannot travel seated.
              </p>
            </Link>
          </div>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            <Link
              to="/join-our-network"
              className="p-8 rounded-[1rem] bg-white border hover:border-accent transition-colors"
              style={{ borderColor: `${NAVY}1f` }}
            >
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: NAVY }}>
                Join Our Provider Network
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                Are you a Florida NEMT provider? Get verified, gain leads, and grow with us.
              </p>
            </Link>
            <Link
              to="/training"
              className="p-8 rounded-[1rem] bg-white border hover:border-accent transition-colors"
              style={{ borderColor: `${NAVY}1f` }}
            >
              <h3 className="font-display font-bold text-xl mb-2" style={{ color: NAVY }}>
                My Florida NEMT Training Academy
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: `${NAVY}b3` }}>
                Certify your drivers and dispatchers with HIPAA and NEMT safety courses.
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 py-20" style={{ background: NAVY, color: "#fff" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="font-display font-bold text-3xl lg:text-4xl mb-6">
            Ready to book your ride?
          </h2>
          <p className="text-white/75 mb-8 max-w-xl mx-auto">
            Statewide dispatch, Medicaid billing handled, on-time pickup guaranteed.
          </p>
          <Link
            to="/request-a-ride"
            className="font-bold px-8 py-4 rounded-[0.875rem] inline-flex items-center gap-2"
            style={{ background: ORANGE, color: NAVY }}
          >
            Request a Ride <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </div>
  );
}

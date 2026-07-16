import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Package, Snowflake, ShieldCheck, Clock, Truck, FileText } from "lucide-react";
import { buildServiceSchema } from "@/lib/schema";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";

const NAVY = "#13335a";
const ORANGE = "#e07a1f";

const TITLE = "Medical Deliveries in Florida | Start Sending Medical Deliveries";
const DESCRIPTION =
  "Non-emergency medical delivery across Florida for prescriptions, lab samples, medical supplies, DME, and equipment. Vetted providers, real-time tracking, HIPAA-aware handoffs.";
const URL = "https://myfloridanemt.com/services/medical-deliveries";

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "What can I send through My Florida NEMT medical delivery?",
    a: "Prescriptions, lab and specimen samples, medical supplies, durable medical equipment (DME), small equipment, and other non-emergency healthcare items. Anything hazardous, biohazardous, or temperature-sensitive can be flagged so the receiving provider handles it correctly.",
  },
  {
    q: "Who uses medical deliveries on My Florida NEMT?",
    a: "Pharmacies, independent labs, home-health agencies, skilled nursing facilities, hospitals, DME suppliers, clinics, and other healthcare organizations that need reliable last-mile delivery in Florida.",
  },
  {
    q: "How is pricing calculated?",
    a: "Each provider sets their own delivery rate book: a base pickup fee, per-mile mileage, wait time, and optional surcharges for cold-chain, signature-required, and rush deliveries. You always see a full financial breakdown before submitting a request.",
  },
  {
    q: "Is it HIPAA-aware?",
    a: "Yes. Every request requires a HIPAA acknowledgment, deliveries are handled by vetted providers with credentialed drivers, and the platform captures a proof-of-delivery record for each completed delivery.",
  },
  {
    q: "Where in Florida do you deliver?",
    a: "My Florida NEMT operates statewide with providers in every major Florida market, including Jacksonville, Orlando, Tampa, Miami, Fort Lauderdale, Gainesville, Fort Myers, Naples, and Tallahassee.",
  },
];

export const Route = createFileRoute("/services/medical-deliveries")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(
          buildServiceSchema({
            name: "Medical Deliveries",
            serviceType: "Non-emergency medical delivery",
            description: DESCRIPTION,
            url: URL,
          })
        ),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: MedicalDeliveriesPage,
});

const ITEMS = [
  { icon: FileText, title: "Prescriptions", copy: "Retail and specialty pharmacy runs, home delivery, refills." },
  { icon: Snowflake, title: "Lab & specimen samples", copy: "Temperature-sensitive courier for labs and clinical trials." },
  { icon: Package, title: "Medical supplies", copy: "Wound-care, catheters, sterile supplies, PPE, and consumables." },
  { icon: Truck, title: "Equipment & DME", copy: "Wheelchairs, walkers, oxygen accessories, small equipment moves." },
];

const AUDIENCE = [
  "Pharmacies",
  "Independent & hospital labs",
  "Skilled nursing facilities",
  "Hospitals & clinics",
  "Home-health agencies",
  "DME suppliers",
  "Physician offices",
  "Healthcare organizations",
];

const HOW_IT_WORKS = [
  { step: "1", title: "Create a delivery request", body: "Enter pickup, drop-off, item type, and any handling requirements. Get an instant price estimate." },
  { step: "2", title: "Matched to a vetted provider", body: "Our approved Florida NEMT providers with delivery service enabled are matched by zone and requirements." },
  { step: "3", title: "Tracked and confirmed", body: "Real-time status updates, driver check-in, and a proof-of-delivery record captured on completion." },
];

function MedicalDeliveriesPage() {
  return (
    <>
      <section className="pt-10 lg:pt-14 px-6">
        <div className="max-w-6xl mx-auto">
          <Breadcrumbs items={[{ label: "Services", to: "/services" }, { label: "Medical Deliveries" }]} />
        </div>
      </section>

      <section className="py-14 lg:py-20 px-6" style={{ backgroundColor: NAVY, color: "white" }}>
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] mb-4" style={{ color: ORANGE }}>
              Non-emergency medical delivery · Statewide Florida
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-[1.05] mb-6">
              Start Sending Medical Deliveries in Florida.
            </h1>
            <p className="text-lg text-white/85 max-w-2xl mb-8">
              My Florida NEMT supports non-emergency medical deliveries for prescriptions, medical samples, supplies, equipment, and other healthcare items — moved by vetted Florida transportation providers you can trust.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/facility.login"
                className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-sm"
                style={{ backgroundColor: ORANGE, color: NAVY }}
              >
                Start sending deliveries <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/join-our-network"
                className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-sm border-2 border-white/40 hover:border-white"
              >
                Become a delivery provider
              </Link>
            </div>
          </div>
          <div className="rounded-sm border border-white/15 bg-white/5 p-6 grid grid-cols-2 gap-4">
            {[
              { icon: ShieldCheck, label: "Vetted providers" },
              { icon: Snowflake, label: "Cold-chain option" },
              { icon: Clock, label: "Rush deliveries" },
              { icon: FileText, label: "HIPAA-aware" },
            ].map((s) => (
              <div key={s.label} className="flex items-start gap-3">
                <s.icon className="h-6 w-6 shrink-0" style={{ color: ORANGE }} />
                <div className="text-sm font-bold">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-3">What you can send</h2>
          <p className="text-muted-foreground max-w-2xl mb-10">
            If it's healthcare-related and non-emergency, chances are we can move it. Every request captures item type and handling notes so the receiving provider is set up for success.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ITEMS.map((it) => (
              <div key={it.title} className="border border-border rounded-sm p-5 bg-card">
                <it.icon className="h-6 w-6 mb-3" style={{ color: ORANGE }} />
                <h3 className="font-extrabold tracking-tight mb-1">{it.title}</h3>
                <p className="text-sm text-muted-foreground">{it.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">Built for healthcare organizations</h2>
            <p className="text-muted-foreground mb-6 max-w-xl">
              A single connected network of Florida providers gives your team one place to request, track, and reconcile every delivery — whether you're a pharmacy sending prescriptions, a lab moving specimens, or a DME supplier delivering equipment.
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {AUDIENCE.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-accent" /> {a}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-6">How it works</h2>
            <ol className="space-y-4">
              {HOW_IT_WORKS.map((s) => (
                <li key={s.step} className="flex gap-4">
                  <div className="shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-extrabold text-sm" style={{ backgroundColor: ORANGE, color: NAVY }}>
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-extrabold tracking-tight">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-6">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight mb-4">Flexible, transparent pricing</h2>
            <p className="text-muted-foreground mb-4">
              Every delivery provider on My Florida NEMT sets their own delivery rate book. The platform combines their rates with a small transparent platform fee so businesses always see the full breakdown before confirming a request.
            </p>
            <ul className="space-y-2 text-sm">
              {[
                "Base pickup fee",
                "Per-mile mileage",
                "Wait time billed per minute, half-hour, or hour",
                "Optional cold-chain surcharge for temperature-controlled items",
                "Optional signature-required surcharge",
                "Optional rush / priority surcharge",
                "Minimum delivery fee protection",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="h-4 w-4 mt-0.5 text-accent shrink-0" /> {line}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-border rounded-sm bg-card p-6">
            <h3 className="font-extrabold tracking-tight text-xl mb-3">Frequently asked questions</h3>
            <div className="divide-y divide-border">
              {FAQ.map((f) => (
                <details key={f.q} className="py-3 group">
                  <summary className="cursor-pointer font-bold text-sm flex items-center justify-between gap-4">
                    {f.q}
                    <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20 px-6" style={{ backgroundColor: NAVY, color: "white" }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-4">
            Ready to move your first delivery?
          </h2>
          <p className="text-white/85 max-w-2xl mx-auto mb-8">
            Whether you send a handful of prescriptions a day or move hundreds of specimens across Florida, get started in minutes with My Florida NEMT.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              to="/facility.login"
              className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-sm"
              style={{ backgroundColor: ORANGE, color: NAVY }}
            >
              Start sending deliveries <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/join-our-network"
              className="inline-flex items-center gap-2 font-bold px-6 py-3 rounded-sm border-2 border-white/40 hover:border-white"
            >
              Become a delivery provider
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

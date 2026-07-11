import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, TrendingUp, Globe, ShieldCheck, LifeBuoy, MapPin } from "lucide-react";

export const Route = createFileRoute("/join-our-network")({
  head: () => ({
    meta: [
      { title: "Join Our Network — My Florida NEMT Providers Statewide" },
      {
        name: "description",
        content:
          "Launching a non-emergency medical transportation business in Florida? Get exclusive NEMT leads, a verified profile, and statewide patient demand from Pensacola to the Keys.",
      },
      { property: "og:title", content: "Join the My Florida NEMT Provider Network" },
      { property: "og:description", content: "Exclusive NEMT leads and statewide demand for Florida providers." },
      { property: "og:url", content: "/join-our-network" },
    ],
    links: [{ rel: "canonical", href: "/join-our-network" }],
  }),
  component: JoinNetworkPage,
});

const benefits = [
  {
    icon: TrendingUp,
    title: "Exclusive My Florida NEMT Leads",
    body:
      "Stop chasing dispatch boards. Get high-intent trip requests routed to your service area — Jacksonville, Tampa, Orlando, Miami, Gainesville, Daytona, Southwest Florida and every county in between.",
  },
  {
    icon: Globe,
    title: "Statewide Online Presence",
    body:
      "Your verified provider profile is indexed across our city and county landing pages, so patients searching “NEMT near me” in your local market find you first.",
  },
  {
    icon: ShieldCheck,
    title: "Trusted, Compliant Partnership",
    body:
      "We vet every provider's documentation — driver license, insurance, W-9, EIN, NPI, and vehicle inspections — so facilities and case managers can refer with confidence.",
  },
  {
    icon: LifeBuoy,
    title: "End-to-End Business Support",
    body:
      "From AHCA registration help to operations templates, billing setup, Stripe payouts, and rate sheets — we hand you the playbook we use ourselves.",
  },
];

const requirements = [
  "Valid Florida driver license (clean MVR)",
  "Commercial auto / livery insurance certificate",
  "W-9 and Business EIN",
  "NPI (for Medicaid-billing providers)",
  "ADA-compliant vehicle inspection",
  "HIPAA acknowledgment + driver background check",
];

const steps = [
  { n: "01", title: "Apply online", body: "Tell us your service area, vehicle types, and contact info — takes about 5 minutes." },
  { n: "02", title: "Upload documents", body: "Securely submit your license, insurance, W-9, EIN, NPI, and vehicle photos." },
  { n: "03", title: "Get verified", body: "Our team reviews everything within 1–2 business days and activates your profile." },
  { n: "04", title: "Start receiving trips", body: "Patient, facility, and broker requests flow into your provider dashboard the same day you go live." },
];

function JoinNetworkPage() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-primary text-primary-foreground">
        <div className="reliability-grid absolute inset-0 opacity-30" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-6 py-24 lg:py-32 grid lg:grid-cols-[1.3fr_1fr] gap-12 items-end">
          <div>
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.22em] mb-5">
              Provider Network · Statewide Florida
            </p>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95] mb-6">
              Join the FloridaNEMT network.
            </h1>
            <p className="text-lg lg:text-xl text-primary-foreground/80 max-w-2xl">
              Whether you're a brand-new NEMT entrepreneur or an established fleet, My Florida NEMT
              connects you with real patient demand across the state — and the support to scale.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/providers"
                className="px-8 py-4 bg-accent text-accent-foreground font-bold text-sm tracking-widest uppercase rounded-md hover:scale-[1.02] transition"
              >
                Apply to Join
              </Link>
              <Link
                to="/contact"
                className="px-8 py-4 border border-primary-foreground/30 text-primary-foreground font-bold text-sm tracking-widest uppercase rounded-md hover:bg-primary-foreground/10 transition"
              >
                Talk to our team
              </Link>
            </div>
          </div>
          <div className="bg-card text-card-foreground rounded-2xl p-8 shadow-2xl">
            <p className="font-mono text-xs text-accent font-bold uppercase tracking-widest mb-3">Attention new NEMT owners</p>
            <h2 className="text-2xl font-extrabold tracking-tight mb-3">Launching your NEMT business?</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              We've helped operators across Florida get from a parked van to a paid trip in under a week.
              Get exclusive leads, marketing exposure, and onboarding support — all in one place.
            </p>
            <div className="mt-5 pt-5 border-t border-border flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-4 text-accent" /> Serving every Florida county
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-12 max-w-3xl">
            Why providers partner with My FloridaNEMT.
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card border border-border rounded-2xl p-8">
                <b.icon className="size-7 text-accent mb-4" />
                <h3 className="text-xl font-extrabold tracking-tight mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6 bg-secondary/40 border-y border-border">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12">
          <div>
            <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-3">Documentation</p>
            <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-6">
              What you'll need to get approved.
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              We keep things simple: upload your documents once and we'll do the verification. Most
              providers go from application to live network listing in 1–2 business days.
            </p>
            <ul className="space-y-3">
              {requirements.map((r) => (
                <li key={r} className="flex gap-3 text-base">
                  <CheckCircle2 className="size-5 text-accent shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            {steps.map((s) => (
              <div key={s.n} className="bg-card border border-border rounded-xl p-6 flex gap-5">
                <span className="font-mono text-2xl font-extrabold text-accent">{s.n}</span>
                <div>
                  <h3 className="font-extrabold text-lg mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto bg-primary text-primary-foreground rounded-3xl p-12 lg:p-20 text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-6">
            Ready to grow your NEMT business in Florida?
          </h2>
          <p className="text-primary-foreground/80 max-w-2xl mx-auto mb-8">
            Apply today and start receiving qualified trip requests in your service area.
          </p>
          <Link
            to="/providers"
            className="inline-block px-10 py-5 bg-accent text-accent-foreground font-bold text-sm tracking-widest uppercase rounded-md hover:scale-105 transition-transform"
          >
            Start your application
          </Link>
        </div>
      </section>
    </>
  );
}

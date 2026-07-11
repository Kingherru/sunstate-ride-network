import { createFileRoute, Link } from "@tanstack/react-router";
import { Phone, Calendar, Car, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — MyFloridaNemt.com for Patients & Caregivers" },
      {
        name: "description",
        content:
          "Learn how MyFloridaNemt.com helps patients across the state get safe, dignified non-emergency medical transportation — from coverage check to door-to-door pickup.",
      },
      { property: "og:title", content: "How MyFloridaNemt.com Works" },
      { property: "og:description", content: "Coverage check, booking, and door-to-door pickup across Florida." },
      { property: "og:url", content: "https://myfloridanemt.com/how-it-works" },
    ],
    links: [{ rel: "canonical", href: "https://myfloridanemt.com/how-it-works" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Does Florida Medicaid cover non-emergency medical transportation?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Yes. Most Florida Medicaid managed care plans cover NEMT at no cost to eligible members for medically necessary appointments such as dialysis, oncology, therapy, and follow-up visits.",
              },
            },
            {
              "@type": "Question",
              name: "How do I book a ride through MyFloridaNemt.com?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Request a ride on our website and we route it to a vetted local NEMT provider in your county. You'll get pickup details and can reach the driver directly.",
              },
            },
            {
              "@type": "Question",
              name: "What types of transport are available?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Ambulatory, wheelchair, and stretcher (gurney) transport are available statewide with ADA-equipped vehicles and trained crews.",
              },
            },
            {
              "@type": "Question",
              name: "What if I'm not on Medicaid?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Private-pay rides are supported. We match you with a provider that fits your budget — use our trip calculator for an estimate.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: HowItWorksPage,
});

const steps = [
  {
    icon: ShieldCheck,
    n: "01",
    title: "Check your coverage",
    body:
      "Contact your insurance, Medicaid plan, or Workers' Comp adjuster to confirm transportation benefits. Many Florida Medicaid plans cover NEMT at no cost to you. If you're private pay, we'll match you with a provider that fits your budget — see our trip calculator.",
  },
  {
    icon: Calendar,
    n: "02",
    title: "Book a ride with a local provider",
    body:
      "Request a ride through MyFloridaNemt.com and we route it to a vetted local provider in your county. Unlike rideshare, NEMT providers don't cancel after booking — and they arrive on time for dialysis, oncology, therapy, and follow-up appointments.",
  },
  {
    icon: Car,
    n: "03",
    title: "Door-to-door pickup & drop-off",
    body:
      "Your assigned driver arrives in a clean, ADA-equipped vehicle. We support ambulatory, wheelchair, and stretcher transport, with trained crews who help you safely from your front door to the appointment and back home.",
  },
];

const promises = [
  "Anxiety-free, stress-free, hassle-free rides",
  "On-time pickups and drop-offs",
  "Clean, comfortable, professional vehicles",
  "Direct communication with your driver",
  "Trained, background-checked, HIPAA-aware crews",
];

function HowItWorksPage() {
  return (
    <>
      <section className="border-b border-border bg-secondary/40">
        <div className="max-w-7xl mx-auto px-6 py-24 lg:py-32">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.22em] mb-5">
            For Patients · Statewide Florida
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter leading-[0.95] mb-6 max-w-4xl">
            How MyFloridaNemt.com works for patients.
          </h1>
          <p className="text-lg lg:text-xl text-muted-foreground max-w-3xl">
            Whether you've been injured on the job, are recovering from surgery, or simply lack
            access to a car, MyFloridaNemt.com tailors safe, VIP-style transportation to your needs —
            from Pensacola to the Keys. You'll feel more like family than a passenger.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/request-a-ride"
              className="px-8 py-4 bg-primary text-primary-foreground font-bold text-sm tracking-widest uppercase rounded-md"
            >
              Request a Ride
            </Link>
            <a
              href="tel:+1-555-555-5555"
              className="px-8 py-4 border border-primary/20 text-primary font-bold text-sm tracking-widest uppercase rounded-md hover:bg-primary/5 inline-flex items-center gap-2"
            >
              <Phone className="size-4" /> Call dispatch
            </a>
          </div>
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {steps.map((s) => (
            <article
              key={s.n}
              className="bg-card border border-border rounded-2xl p-8 lg:p-12 grid lg:grid-cols-[auto_1fr] gap-8"
            >
              <div className="flex lg:flex-col items-start gap-4">
                <span className="font-mono text-sm font-bold text-accent tracking-widest">
                  STEP {s.n}
                </span>
                <s.icon className="size-10 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight mb-3">{s.title}</h2>
                <p className="text-muted-foreground leading-relaxed text-base">{s.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="py-20 lg:py-28 px-6 bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">Our promise</p>
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-10">
            What we deliver on every ride.
          </h2>
          <ul className="grid md:grid-cols-2 gap-x-10 gap-y-5">
            {promises.map((p) => (
              <li key={p} className="flex gap-3 text-lg">
                <span className="mt-2 size-2 rounded-full bg-accent shrink-0" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-6">
            Need a ride to your next appointment?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
            We serve every Florida county — including Jacksonville, Tampa, Orlando, Miami,
            Gainesville, Daytona, and Southwest Florida.
          </p>
          <Link
            to="/request-a-ride"
            className="inline-block px-10 py-5 bg-accent text-accent-foreground font-bold text-sm tracking-widest uppercase rounded-md hover:scale-105 transition-transform"
          >
            Book your ride
          </Link>
        </div>
      </section>
    </>
  );
}

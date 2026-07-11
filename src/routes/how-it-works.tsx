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
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }),
      },
    ],
  }),
  component: HowItWorksPage,
});

const faqs = [
  {
    q: "What is non-emergency medical transportation (NEMT)?",
    a: "NEMT is scheduled, non-ambulance transportation to and from medical appointments for people who can't safely drive or use public transit. It covers ambulatory rides, wheelchair-accessible vans, and stretcher (gurney) transport for visits like dialysis, oncology, therapy, and specialist follow-ups.",
  },
  {
    q: "Does Florida Medicaid cover non-emergency medical transportation?",
    a: "Yes. Most Florida Medicaid managed care plans cover NEMT at no cost to eligible members when the trip is to a medically necessary, covered service. Coverage is arranged through your plan's transportation broker — MyFloridaNemt.com works with vetted local providers who accept these trips.",
  },
  {
    q: "Does Medicare cover medical transportation?",
    a: "Original Medicare (Parts A and B) generally does not cover non-emergency medical transportation. Some Medicare Advantage (Part C) plans include a limited NEMT benefit — check your plan's Evidence of Coverage. Medicare only covers ambulance transport when it's medically necessary and other transport would endanger your health.",
  },
  {
    q: "Does Medicare cover transportation to medical appointments?",
    a: "Routine trips to medical appointments are not covered by Original Medicare. Medicare Advantage plans may offer a set number of one-way rides per year as a supplemental benefit. For everyday appointment transportation, most Florida patients rely on Medicaid NEMT, private pay, or a plan-specific benefit.",
  },
  {
    q: "Does Medicare cover non-emergency medical transportation?",
    a: "Not through Original Medicare in most cases. Coverage is limited to medically necessary ambulance transport. Some Medicare Advantage plans add NEMT as a supplemental benefit — confirm details with your plan before booking.",
  },
  {
    q: "Who pays for non-emergency medical transportation?",
    a: "Depending on the patient, NEMT is paid by Florida Medicaid (through the plan's transportation broker), a Medicare Advantage supplemental benefit, Workers' Compensation, private insurance, a hospital or facility discharge program, or the patient out of pocket. MyFloridaNemt.com helps you identify which of these applies before you book.",
  },
  {
    q: "How much does Medicaid pay for non-emergency transportation?",
    a: "Medicaid pays the contracted rate directly to the transportation provider — patients typically pay $0 out of pocket for covered trips. Rates vary by state, level of service (ambulatory, wheelchair, stretcher), mileage, and any wait time. In Florida, trips are coordinated through the Medicaid plan's transportation broker.",
  },
  {
    q: "How much does non-emergency medical transport cost if I pay privately?",
    a: "Private-pay NEMT in Florida typically runs $25–$60 for a short ambulatory trip, $50–$125 for wheelchair transport, and $150+ for stretcher transport, plus per-mile charges on longer routes. Use our trip calculator on the request-a-ride page for an instant estimate.",
  },
  {
    q: "How much does long-distance medical transport cost?",
    a: "Long-distance NEMT is billed at a base rate plus a per-mile charge (commonly $2–$5 per loaded mile, higher for stretcher service). A cross-Florida wheelchair transport can range from a few hundred to over a thousand dollars depending on distance, level of service, and whether an attendant is required.",
  },
  {
    q: "Does Medicaid provide transportation to any appointment?",
    a: "Medicaid covers rides to medically necessary services covered by your plan — primary care, specialists, dialysis, behavioral health, dental, pharmacy pickups in some cases, and hospital discharge. Trips to non-covered services (like gym visits) generally aren't eligible.",
  },
];


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

      <section className="py-20 lg:py-28 px-6 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Patient FAQs
          </p>
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-10">
            Coverage, cost & eligibility.
          </h2>
          <div className="divide-y divide-border border-y border-border">
            {faqs.map((f) => (
              <details key={f.q} className="group py-6">
                <summary className="cursor-pointer list-none flex justify-between items-start gap-6 text-left">
                  <h3 className="text-lg lg:text-xl font-bold tracking-tight text-foreground">
                    {f.q}
                  </h3>
                  <span
                    aria-hidden
                    className="mt-1 shrink-0 font-mono text-2xl leading-none text-accent transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-4 text-muted-foreground leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
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

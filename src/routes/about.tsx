import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — My Florida NEMT" },
      {
        name: "description",
        content:
          "My Florida NEMT is a statewide gateway connecting patients with vetted non-emergency medical transport providers and the training that keeps them compliant.",
      },
      { property: "og:title", content: "About My Florida NEMT" },
      { property: "og:description", content: "Statewide medical transport gateway and training academy." },
      { property: "og:url", content: "/about" },
    ],
    links: [{ rel: "canonical", href: "/about" }],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <section className="py-20 lg:py-28 px-6">
      <div className="max-w-3xl mx-auto">
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
          About
        </p>
        <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tighter mb-8">
          Florida's NEMT gateway.
        </h1>
        <div className="prose prose-lg max-w-none text-muted space-y-6 text-base leading-relaxed">
          <p>
            My Florida NEMT is a statewide gateway connecting patients, providers, and brokers
            in non-emergency medical transportation. We coordinate trips across every major Florida
            hub and run the training academy that keeps drivers compliant.
          </p>
          <p>
            We exist because patients deserve consistent, dignified transport regardless of which
            corner of the state they live in. Patients shouldn't have to call ten different
            companies to find a ride to dialysis — and providers shouldn't have to compete for every
            individual trip. We're the layer that makes both sides work.
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground !mt-12">What we do</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>Operate a statewide intake and dispatch network</li>
            <li>Vet and onboard NEMT providers (vehicles, drivers, credentials)</li>
            <li>Deliver certified NEMT and HIPAA training to professional drivers</li>
            <li>Match patient trip requests with the right local provider</li>
          </ul>
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground !mt-12">Our principles</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong>On-time, every time.</strong> Punctuality is the product.</li>
            <li><strong>Dignified care.</strong> Every patient, every transport level.</li>
            <li><strong>Compliance by default.</strong> HIPAA, ADA, AHCA — built in, not bolted on.</li>
            <li><strong>Open to all providers.</strong> Small operators and large fleets both welcome.</li>
          </ul>
        </div>
        <div className="mt-12 flex flex-wrap gap-4">
          <Link
            to="/providers"
            className="px-8 py-4 bg-primary text-primary-foreground font-bold rounded-sm text-sm tracking-wide uppercase"
          >
            Join the network
          </Link>
          <Link
            to="/contact"
            className="px-8 py-4 border-2 border-primary/10 text-primary font-bold rounded-sm text-sm tracking-wide uppercase hover:bg-primary/5"
          >
            Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}

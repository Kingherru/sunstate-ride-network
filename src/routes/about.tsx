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
          Simple Non Emergency Medical Transportation Technology Built Around People
        </h1>
        <div className="prose prose-lg max-w-none text-muted space-y-6 text-base leading-relaxed">
          <p>
            At My Florida NEMT, our goal is to make non-emergency medical transportation easier for everyone involved. Transportation does not need to be complicated, and the software used to manage it should never become a burden.
          </p>
          <p>
            Many scheduling and dispatch systems are powerful but difficult to learn, requiring unnecessary steps and creating frustration for providers, facilities, and patients. We believe technology should simplify transportation, not make it harder.
          </p>
          <p>
            Our platform is designed with a focus on simplicity, efficiency, and real-world workflows. Providers should be able to manage trips easily, facilities should be able to request transportation without confusion, and patients should have a clear and reliable experience from start to finish.
          </p>
          <p>
            My Florida NEMT is built to support Florida’s growing need for reliable non-emergency medical transportation, including Medicaid transportation, healthcare facility transportation, broker coordination, and workers’ compensation transportation. Our platform helps connect transportation providers with hospitals, nursing homes, group homes, rehabilitation centers, and other healthcare organizations that need dependable transportation solutions.
          </p>
          <p>
            We understand that every passenger has different needs, from routine medical appointments to specialized transportation for cancer treatments, dialysis appointments, therapy visits, and ongoing healthcare services. By creating a simple connection between patients, facilities, brokers, dispatch teams, and transportation providers, we help make the entire transportation process easier to manage.
          </p>
          <p>
            Every feature we build is designed around one question: Does this make transportation easier?
          </p>
          <p>
            By combining modern technology with an easy-to-use experience, My Florida NEMT helps connect patients, facilities, dispatch teams, Medicaid transportation providers, and healthcare organizations throughout Florida without adding unnecessary complexity.
          </p>
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

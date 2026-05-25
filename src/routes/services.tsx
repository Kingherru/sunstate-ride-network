import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/services")({
  head: () => ({
    meta: [
      { title: "Services — Ambulatory, Wheelchair & Stretcher | Florida NEMT" },
      {
        name: "description",
        content:
          "Three specialized levels of non-emergency medical transport across Florida: ambulatory, wheelchair, and gurney/stretcher service with certified crews.",
      },
      { property: "og:title", content: "NEMT Services — Florida NEMT Network" },
      { property: "og:description", content: "Ambulatory, wheelchair, and stretcher medical transport." },
      { property: "og:url", content: "/services" },
    ],
    links: [{ rel: "canonical", href: "/services" }],
  }),
  component: ServicesPage,
});

const services = [
  {
    code: "S-01",
    title: "Ambulatory Transport",
    summary:
      "For patients who can walk independently or with minor assistance. Door-through-door support, with help to and from the vehicle.",
    bullets: [
      "Curb-to-curb and door-through-door options",
      "Help with bags, walkers, and canes",
      "Dialysis, oncology, and follow-up clinic runs",
      "Family member or aide may accompany",
    ],
  },
  {
    code: "S-02",
    title: "Wheelchair Transport",
    summary:
      "ADA-equipped vans with hydraulic lifts or low-floor ramps and four-point securement systems. Drivers trained in transfer protocols.",
    bullets: [
      "Hydraulic lift and ramp-equipped fleet",
      "Four-point wheelchair securement",
      "Bariatric wheelchair accommodations on request",
      "Power and manual chairs both welcome",
    ],
  },
  {
    code: "S-03",
    title: "Gurney / Stretcher Transport",
    summary:
      "Non-emergency bed-to-bed and facility-to-facility transfers on a stretcher, staffed by two-person crews trained in safe patient handling.",
    bullets: [
      "Two-person trained crews on every run",
      "Hospital, SNF, and home transfers",
      "Bariatric stretcher options available",
      "Long-distance intra-state transport",
    ],
  },
] as const;

function ServicesPage() {
  return (
    <>
      <section className="py-20 lg:py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Capabilities
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter max-w-3xl mb-6">
            Three levels of care, one statewide standard.
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            Every Florida NEMT Network ride is dispatched, vetted, and confirmed against our
            patient-safety checklist — regardless of which service level you book.
          </p>
        </div>
      </section>

      <section className="pb-24 px-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {services.map((s) => (
            <article
              key={s.code}
              className="bg-card border border-border rounded-2xl p-10 lg:p-14 grid lg:grid-cols-[1fr_2fr] gap-10"
            >
              <div>
                <span className="font-mono text-xs text-accent font-bold tracking-widest">{s.code}</span>
                <h2 className="text-3xl font-extrabold tracking-tighter mt-2">{s.title}</h2>
              </div>
              <div>
                <p className="text-muted text-base leading-relaxed mb-6">{s.summary}</p>
                <ul className="space-y-3">
                  {s.bullets.map((b) => (
                    <li key={b} className="flex gap-3 text-sm">
                      <span className="mt-1.5 size-1.5 rounded-full bg-accent shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto bg-primary text-primary-foreground rounded-3xl p-12 lg:p-20 text-center">
          <h2 className="text-3xl lg:text-5xl font-extrabold tracking-tighter mb-6">
            Ready to book a ride?
          </h2>
          <Link
            to="/request-a-ride"
            className="inline-block px-10 py-5 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:scale-105 transition-transform"
          >
            Request a Ride
          </Link>
        </div>
      </section>
    </>
  );
}

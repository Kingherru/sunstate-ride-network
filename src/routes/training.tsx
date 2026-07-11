import { createFileRoute, Link } from "@tanstack/react-router";
import { useProviderOnlyGate } from "@/lib/portal-guard";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training Academy — My Florida NEMT & HIPAA Courses" },
      {
        name: "description",
        content:
          "My Florida NEMT training academy. Certified online courses for non-emergency medical transport drivers: My Florida NEMT Basics ($100) and HIPAA Training ($100).",
      },
      { property: "og:title", content: "NEMT Training Academy — My Florida NEMT" },
      { property: "og:description", content: "$100 online certification courses for NEMT professionals." },
      { property: "og:url", content: "/training" },
    ],
    links: [{ rel: "canonical", href: "/training" }],
  }),
  component: TrainingPage,
});

const courses = [
  {
    code: "C-01",
    title: "My Florida NEMT Basics",
    summary:
      "The foundation course for non-emergency medical transport in Florida. State regulations, safe patient handling, securement, defensive driving, and trip documentation.",
    modules: [
      "Florida AHCA & DOT regulations",
      "Patient handling & transfer technique",
      "Wheelchair securement & ADA standards",
      "Documentation & trip logs",
      "Defensive driving & incident response",
    ],
    duration: "~6 hours · self-paced",
    price: 100,
  },
  {
    code: "C-02",
    title: "HIPAA Training",
    summary:
      "Patient-privacy training tailored for NEMT drivers and dispatchers. Covers Protected Health Information, allowed disclosures, and what to do if something goes wrong.",
    modules: [
      "PHI fundamentals for transport",
      "Allowed and disallowed disclosures",
      "Phone, text, and in-vehicle conversations",
      "Breach recognition and reporting",
      "Annual recertification checklist",
    ],
    duration: "~3 hours · self-paced",
    price: 100,
  },
] as const;

function TrainingPage() {
  useProviderOnlyGate();
  return (
    <>
      <section className="py-20 lg:py-28 px-6 border-b border-border">
        <div className="max-w-7xl mx-auto">
          <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">
            Training Academy
          </p>
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tighter max-w-3xl mb-6">
            Certified NEMT professionals start here.
          </h1>
          <p className="text-lg text-muted max-w-2xl">
            Two essential online courses for every My Florida NEMT driver and dispatcher. Self-paced,
            with a certificate of completion at the end of each.
          </p>
        </div>
      </section>

      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-8">
          {courses.map((c) => (
            <article key={c.code} className="bg-card border border-border rounded-2xl p-10 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-4 py-1.5 bg-accent text-accent-foreground font-mono text-[10px] font-bold">
                ${c.price}.00
              </div>
              <span className="font-mono text-xs text-accent font-bold tracking-widest">{c.code}</span>
              <h2 className="text-3xl font-extrabold tracking-tighter mt-2 mb-4">{c.title}</h2>
              <p className="text-muted text-sm leading-relaxed mb-6">{c.summary}</p>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted mb-6">
                {c.duration}
              </p>
              <ul className="space-y-2 mb-8">
                {c.modules.map((m) => (
                  <li key={m} className="flex gap-3 text-sm">
                    <span className="mt-1.5 size-1.5 rounded-full bg-primary shrink-0" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="w-full py-4 bg-primary text-primary-foreground font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-all rounded-sm"
                onClick={() => alert("Enrollment & payment launching soon. Get notified by contacting us.")}
              >
                Enroll · ${c.price}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto bg-primary text-primary-foreground rounded-3xl p-12 lg:p-16 grid md:grid-cols-[2fr_1fr] gap-8 items-center">
          <div>
            <h2 className="text-3xl font-extrabold tracking-tighter mb-3">
              Running a provider company? Bulk seats available.
            </h2>
            <p className="text-white/70">
              Enroll your full driver roster at a discount and track completion centrally.
            </p>
          </div>
          <Link
            to="/contact"
            className="inline-block text-center px-8 py-4 bg-accent text-accent-foreground font-bold rounded-sm text-sm tracking-widest uppercase hover:scale-105 transition-transform"
          >
            Talk to us
          </Link>
        </div>
      </section>
    </>
  );
}

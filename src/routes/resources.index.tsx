import { createFileRoute } from "@tanstack/react-router";
import { GraduationCap, HelpCircle, Map, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { PageHero, Reveal, SectionHead, pageHead } from "@/components/public/page-kit";
import { LinkCard } from "@/components/public/coverage-kit";
import { RESOURCES } from "@/lib/resources-content";
import { LINKS } from "@/lib/site-config";

export const Route = createFileRoute("/resources/")({
  head: () => pageHead("/resources", "Florida NEMT Resources — Guides for Riders, Caregivers & Providers | MY FLORIDA NEMT", "Practical guides on Florida non-emergency medical transportation for riders, caregivers, facilities and NEMT providers.", "Resources", "CollectionPage"),
  component: ResourcesPage,
});

const MORE = [
  { i: Workflow, t: "How It Works", h: "/how-it-works" },
  { i: Map, t: "Florida Coverage", h: "/florida-coverage" },
  { i: HelpCircle, t: "People Also Ask", h: LINKS.faq },
  { i: GraduationCap, t: "Training", h: "/training" },
];

function ResourcesPage() {
  const groups = ["Patients & Caregivers", "Providers"] as const;
  return (
    <PublicPage>
      <PageHero showCrumbs crumb="Resources" title="Resources" intro={<p>Practical guides for riders, caregivers, facilities and NEMT providers. New guides are added as they are written and reviewed.</p>} />
      {groups.map((g, gi) => (
        <section key={g} aria-labelledby={`g-${gi}`} className={gi % 2 ? "mfn-section bg-ds-surface" : "mfn-section bg-ds-bg"}>
          <div className="mfn-container">
            <Reveal><SectionHead id={`g-${gi}`} title={`For ${g.toLowerCase()}`} /></Reveal>
            <ul className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-2 lg:grid-cols-3">
              {RESOURCES.filter((r) => r.audience === g).map((r, i) => (
                <li key={r.slug}><Reveal delay={i * 60}><LinkCard href={`/resources/${r.slug}`} title={r.title} text={r.description} /></Reveal></li>
              ))}
            </ul>
          </div>
        </section>
      ))}
      <section aria-labelledby="more" className="mfn-section bg-ds-bg">
        <div className="mfn-container">
          <SectionHead id="more" title="More starting points" />
          <ul className="mx-auto mt-8 flex max-w-4xl flex-wrap justify-center gap-x-8 gap-y-3">
            {MORE.map((m) => <li key={m.h}><a href={m.h} className="ds-body-lg inline-flex items-center gap-2 text-ds-link underline-offset-4 hover:underline"><m.i className="size-5" aria-hidden />{m.t}</a></li>)}
          </ul>
        </div>
      </section>
    </PublicPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, GraduationCap, HelpCircle, Map, Workflow } from "lucide-react";
import { PublicPage } from "@/components/public/PublicPage";
import { PageHero, Reveal, pageHead } from "@/components/public/page-kit";
import { LINKS, TRAINING } from "@/lib/site-config";

export const Route = createFileRoute("/resources")({
  head: () => pageHead("/resources", "Florida NEMT Resources — Guides, Training & FAQs | MY FLORIDA NEMT", "Helpful starting points for Florida NEMT: how the network works, coverage, common questions and NEMT training.", "Resources", "CollectionPage"),
  component: ResourcesPage,
});

const ITEMS = [
  { i: Workflow, t: "How It Works", d: "How trip requests and provider-to-provider sharing work.", h: "/how-it-works" },
  { i: Map, t: "Florida Coverage", d: "Explore the network by region, county, city or ZIP.", h: "/florida-coverage" },
  { i: HelpCircle, t: "People Also Ask", d: "Answers for patients, facilities and providers.", h: LINKS.faq },
  ...TRAINING.map((t) => ({ i: GraduationCap, t: t.title, d: "NEMT training course.", h: t.href })),
];

function ResourcesPage() {
  return (
    <PublicPage>
      <PageHero crumb="Resources" title="Resources" intro={<p>Starting points for patients, facilities and NEMT providers. More guides are being prepared.</p>} />
      <section aria-label="Resource links" className="mfn-section bg-ds-bg">
        <ul className="mfn-container grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ITEMS.map((x, i) => (
            <li key={x.t}><Reveal delay={i * 70}>
              <a href={x.h} className="group flex h-full flex-col rounded-ds bg-ds-sky p-6 ds-transition hover:bg-ds-hover focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus">
                <h2 className="ds-subheading flex items-center gap-3 uppercase text-ds-primary"><x.i className="size-6 shrink-0" aria-hidden />{x.t}</h2>
                <p className="ds-body-lg mt-3 flex-1 text-ds-text-2">{x.d}</p>
                <ArrowRight className="mt-4 size-5 text-ds-link ds-transition group-hover:translate-x-1" aria-hidden />
              </a>
            </Reveal></li>
          ))}
        </ul>
      </section>
    </PublicPage>
  );
}

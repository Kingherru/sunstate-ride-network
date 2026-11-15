import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/portal/PortalShell";
import { TrainingTests } from "@/components/portal/TrainingTests";

export const Route = createFileRoute("/_authenticated/portal/training")({
  head: () => ({ meta: [{ title: "Training & Resources — MY FLORIDA NEMT Portal" }, { name: 'description', content: 'Your available courses, tests, purchased guides and certificates.' }, { property: 'og:title', content: 'Training & Resources — MY FLORIDA NEMT Portal' }, { property: 'og:description', content: 'Personal learning progress and purchased resources.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => (
    <>
      <PageHead title="Training & Resources" />
      <TrainingTests />
    </>
  ),
});

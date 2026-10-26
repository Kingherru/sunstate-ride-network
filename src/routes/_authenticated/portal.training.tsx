import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/portal/PortalShell";
import { TrainingTests } from "@/components/portal/TrainingTests";

export const Route = createFileRoute("/_authenticated/portal/training")({
  head: () => ({ meta: [{ title: "Portal Training & Tests — MY FLORIDA NEMT" }, { name: 'description', content: 'Your available courses, tests, purchases and certificates.' }, { property: 'og:title', content: 'Portal Training & Tests — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Personal training and test progress.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => (
    <>
      <PageHead title="Training & Tests">HIPAA and Florida NEMT courses. Certificates are issued when you pass.</PageHead>
      <TrainingTests />
    </>
  ),
});

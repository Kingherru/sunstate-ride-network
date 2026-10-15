import { createFileRoute } from "@tanstack/react-router";
import { PageHead } from "@/components/portal/PortalShell";
import { TrainingTests } from "@/components/portal/TrainingTests";

export const Route = createFileRoute("/_authenticated/portal/training")({
  head: () => ({ meta: [{ title: "Training & Tests — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => (
    <>
      <PageHead title="Training & Tests">HIPAA and Florida NEMT courses. Certificates are issued when you pass.</PageHead>
      <TrainingTests />
    </>
  ),
});

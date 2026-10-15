import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ChangelogView } from "@/components/portal/ChangelogView";

export const Route = createFileRoute("/_authenticated/admin/changelog")({
  head: () => ({ meta: [{ title: "Change Log — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminChangelog,
});

function AdminChangelog() {
  return (
    <>
      <PageHead title="Change Log" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ChangelogView admin />
      </section>
    </>
  );
}

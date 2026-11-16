import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ChangelogView } from "@/components/portal/ChangelogView";

export const Route = createFileRoute("/_authenticated/admin/changelog")({
  head: () => ({ meta: [{ title: "Change Log — MY FLORIDA NEMT" }, { name: 'description', content: 'Review platform updates and retained release history.' }, { property: 'og:title', content: 'Change Log — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Platform updates and retained release history.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminChangelog,
});

function AdminChangelog() {
  return (
    <>
      <PageHead title="Change Log" />
      <section className="portal-admin-module min-w-0">
        <ChangelogView admin />
      </section>
    </>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ContactsPayersPanel } from "@/components/dashboard/ContactsPayersPanel";

type ContactsSearch = { tab?: "patients" | "contacts" | "payers" };

export const Route = createFileRoute("/_authenticated/portal/contacts")({
  head: () => ({ meta: [{ title: "People — MY FLORIDA NEMT" }, { name: 'description', content: 'Your authorized patients, contacts and payers.' }, { property: 'og:title', content: 'People — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your authorized patients, contacts and payers.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): ContactsSearch => ({
    tab: s.tab === 'patients' ? 'patients' : s.tab === "payers" ? "payers" : "contacts",
  }),
  component: PortalContacts,
});

function PortalContacts() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <>
      <PageHead title="People" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ContactsPayersPanel
          tab={tab ?? "contacts"}
          onTab={(t) => navigate({ to: "/portal/contacts", search: prev => ({ ...prev, tab: t }) })}
        />
      </section>
    </>
  );
}

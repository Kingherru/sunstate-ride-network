import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ContactsPayersPanel } from "@/components/dashboard/ContactsPayersPanel";

type ContactsSearch = { tab?: "contacts" | "payers" };

export const Route = createFileRoute("/_authenticated/portal/contacts")({
  head: () => ({ meta: [{ title: "Contacts & Payers — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>): ContactsSearch => ({
    tab: s.tab === "payers" ? "payers" : "contacts",
  }),
  component: PortalContacts,
});

function PortalContacts() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <>
      <PageHead title="Contacts & payers">Payers are billing contacts only. They get no access to your account unless you invite them separately.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ContactsPayersPanel
          tab={tab ?? "contacts"}
          onTab={(t) => navigate({ to: "/portal/contacts", search: { tab: t }, replace: true })}
        />
      </section>
    </>
  );
}

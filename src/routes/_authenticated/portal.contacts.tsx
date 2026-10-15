import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { ContactsPanel } from "@/components/dashboard/ContactsPanel";

export const Route = createFileRoute("/_authenticated/portal/contacts")({
  head: () => ({ meta: [{ title: "Contacts — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalContacts,
});

function PortalContacts() {
  return (
    <>
      <PageHead title="Contacts" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <ContactsPanel />
      </section>
    </>
  );
}

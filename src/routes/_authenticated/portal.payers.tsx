import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { PayersPanel } from "@/components/dashboard/PayersPanel";

export const Route = createFileRoute("/_authenticated/portal/payers")({
  head: () => ({ meta: [{ title: "Payers — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalPayers,
});

function PortalPayers() {
  return (
    <>
      <PageHead title="Payers">Payers are billing contacts only. They get no access to your account unless you invite them separately.</PageHead>
      <section className={`${panelCls} p-4 sm:p-6`}>
        <PayersPanel />
      </section>
    </>
  );
}

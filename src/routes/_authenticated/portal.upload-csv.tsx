import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { DsEmpty } from "@/components/ds/feedback";

export const Route = createFileRoute("/_authenticated/portal/upload-csv")({
  head: () => ({ meta: [{ title: "Upload Csv — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: PortalUploadCsv,
});

function PortalUploadCsv() {
  return (
    <>
      <PageHead title="Upload CSV" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <DsEmpty title="CSV upload is not available yet">Bulk upload will return once each row goes through the same checks and review step as a single request. Nothing is imported from this page.</DsEmpty>
      </section>
    </>
  );
}

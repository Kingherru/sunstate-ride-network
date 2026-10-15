import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { AdminRolesPanel } from "@/components/admin/AdminRolesPanel";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { ExpiringCredentialsPanel } from "@/components/ExpiringCredentialsPanel";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security — MY FLORIDA NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSecurity,
});

function AdminSecurity() {
  return (
    <>
      <PageHead title="Security" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <div className="space-y-10"><AdminRolesPanel /><AuditLogPanel /><ExpiringCredentialsPanel /></div>
      </section>
    </>
  );
}

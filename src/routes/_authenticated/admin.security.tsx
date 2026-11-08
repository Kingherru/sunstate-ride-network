import { createFileRoute } from "@tanstack/react-router";
import { PageHead, panelCls } from "@/components/portal/PortalShell";
import { AdminRolesPanel } from "@/components/admin/AdminRolesPanel";
import { AuditLogPanel } from "@/components/AuditLogPanel";
import { PersonalSecurity } from '@/components/portal/PersonalSecurity';
import { SettingsShell } from '@/components/portal/SettingsShell';
import { useState } from 'react';
import { ExpiringCredentialsPanel } from "@/components/ExpiringCredentialsPanel";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security — MY FLORIDA NEMT" }, {name:"description",content:"Personal sign-in, sessions and authorized administrative security evidence."},{property:"og:title",content:"Security — MY FLORIDA NEMT"},{property:"og:description",content:"Restricted personal and administrative security controls."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSecurity,
});

function AdminSecurity() {
 const {access,user}=Route.useRouteContext();const [tab,setTab]=useState('personal');
  return (
    <>
      <PageHead title="Security" />
      <section className={`${panelCls} p-4 sm:p-6`}>
        <SettingsShell value={tab} onChange={setTab} sections={[{value:'personal',label:'Your security'},...(access.isMasterAdmin?[{value:'oversight',label:'Protected administration'}]:[])]}>
          {tab==='personal'&&<PersonalSecurity email={user.email} securityOnly/>}
          {tab==='oversight'&&access.isMasterAdmin&&<><p className="ds-label">Master Admin access is protected; personal profile fields never change permissions.</p><AdminRolesPanel/><AuditLogPanel/><ExpiringCredentialsPanel/></>}
        </SettingsShell>
      </section>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Monitor, Users } from "lucide-react";
import { PageHead, actionCls, panelCls } from "@/components/portal/PortalShell";
import { PersonalSettings } from '@/components/portal/PersonalSettings';
import { SignInPreference } from '@/components/portal/SignInPreference';
import { InterfaceSize } from '@/components/portal/InterfaceSize';
import { SecureEmailChange } from '@/components/portal/SecureEmailChange';
import { SettingsShell } from '@/components/portal/SettingsShell';
import { useState } from 'react';
import { NetworkTimingSettings } from '@/components/portal/TripNetwork';

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Admin Settings — MY FLORIDA NEMT" }, { name: 'description', content: 'Admin preview tools and future distribution timing settings.' }, { property: 'og:title', content: 'Admin Settings — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Admin preview tools and future distribution timing settings.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: AdminSettings,
});

const PREVIEWS = [
  { to: "/portal", title: "Patient & Facility Portal", body: "The signed-in area every approved account sees: account home, request list, new-request form and account page. You view it as yourself — accounts with their own workspaces see only their own requests." },
  { to: "/portal/requests/new", title: "New Request Form (Portal)", body: "The same request form customers and facilities use inside the portal. Submitting here creates a real request — use the public Book a Trip page for look-only checks, or don't submit." },
  { to: "/portal/account", title: "Account Page", body: "The account details page each signed-in user sees: profile, workspace membership and contact information." },
  { to: "/learn", title: "Training / Learner Area", body: "What a training-only learner sees after sign-in: their enrolled courses, progress and certificates." },
  { to: "/book", title: "Public Booking Page", body: "The public Book a Trip page visitors use without signing in, including the Medical Delivery notice." },
  { to: "/join", title: "Provider Sign-Up Page", body: "The public page transportation providers use to apply to join the network." },
] as const;

function AdminSettings() {
  const { access } = Route.useRouteContext();
  const [tab,setTab]=useState('profile');
  return (
    <>
      <PageHead title="Settings">
        Your own profile, password and admin preview tools. Nothing here changes data unless you submit a form.
      </PageHead>

      <SettingsShell value={tab} onChange={setTab} sections={[{value:'profile',label:'Profile'},{value:'notifications',label:'Notifications'},{value:'interface',label:'Sign-in preferences'},{value:'accessibility',label:'Accessibility'},{value:'tools',label:'Administration'}]}>
      {tab==='profile'&&<><PersonalSettings section="profile"/><SecureEmailChange/><Link to="/admin/security" className="ds-label text-ds-link underline">Security & sign-in</Link></>}
      {tab==='notifications'&&<PersonalSettings section="notifications"/>}
      {tab==='interface'&&<SignInPreference/>}{tab==='accessibility'&&<InterfaceSize/>}
      {tab==='tools'&&<>
      {access.isMasterAdmin && (
        <section className={`${panelCls} mb-6`} aria-labelledby="portal-previews-h">
          <h2 id="portal-previews-h" className="ds-subheading flex items-center gap-2 border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">
            <Monitor className="size-4" aria-hidden />Portal previews
          </h2>
          <div className="space-y-4 px-4 py-4 sm:px-5">
            <p className="ds-support text-ds-text-2">
              View how the Provider and Patient & Facility portals look using real components and synthetic demo data. Nothing here submits a real form, sends a notification or changes your admin session.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/admin/preview/$kind" params={{ kind: "provider" }} className={actionCls}>
                <Users className="size-4" aria-hidden />View provider portal
              </Link>
              <Link to="/admin/preview/$kind" params={{ kind: "customer" }} className={actionCls}>
                <Users className="size-4" aria-hidden />View patient &amp; facility portal
              </Link>
            </div>
          </div>
        </section>
      )}
      {access.isMasterAdmin && (
        <section className={`${panelCls} mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5`}>
          <div className="min-w-0 max-w-2xl">
            <h2 className="ds-subheading uppercase text-ds-primary">Launch readiness</h2>
            <p className="ds-support mt-1 text-ds-text-2">Read-only checklist of what is ready, off, or waiting on owner action.</p>
          </div>
          <Link to="/admin/launch" className={actionCls}>Open</Link>
        </section>
      )}
      {access.isMasterAdmin && <section className={`${panelCls} mb-6 p-5`}><NetworkTimingSettings /></section>}

      <section className={`${panelCls} mb-6`} aria-labelledby="preview-h">
        <h2 id="preview-h" className="ds-subheading border-b border-ds-border px-4 py-3 uppercase text-ds-primary sm:px-5">Other page previews</h2>
        <ul className="divide-y divide-ds-border">
          {PREVIEWS.map((p) => (
            <li key={p.to} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
              <div className="min-w-0 max-w-2xl">
                <h3 className="ds-body font-semibold text-ds-text">{p.title}</h3>
                <p className="ds-support mt-1 text-ds-text-2">{p.body}</p>
              </div>
              <Link to={p.to as "/portal"} className={actionCls}>Open</Link>
            </li>
          ))}
        </ul>
      </section>

      </>}
      </SettingsShell>
    </>
  );
}

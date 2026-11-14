import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({ meta: [{ title: "Security — MY FLORIDA NEMT" }, {name:"description",content:"Personal sign-in, sessions and authorized administrative security evidence."},{property:"og:title",content:"Security — MY FLORIDA NEMT"},{property:"og:description",content:"Restricted personal and administrative security controls."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: () => { throw redirect({ to: '/admin/settings', search: { section: 'profile' }, replace: true }); },
});

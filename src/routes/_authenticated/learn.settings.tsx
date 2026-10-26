import { createFileRoute } from "@tanstack/react-router";
import { PersonalSecurity } from "@/components/portal/PersonalSecurity";

export const Route = createFileRoute("/_authenticated/learn/settings")({
  head: () => ({ meta: [{ title: "Learner Settings — MY FLORIDA NEMT" }, { name: 'description', content: 'Personal learner account and security settings.' }, { property: 'og:title', content: 'Learner Settings — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Private learner account settings.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LearnSettings,
});

function LearnSettings() {
  const { user } = Route.useRouteContext();
  return (
    <div className="theme-portal mx-auto max-w-4xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-extrabold uppercase tracking-tight">Settings</h2>
      <PersonalSecurity email={user.email ?? null} />
    </div>
  );
}

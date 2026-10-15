import { createFileRoute } from "@tanstack/react-router";
import { PersonalSecurity } from "@/components/portal/PersonalSecurity";

export const Route = createFileRoute("/_authenticated/learn/settings")({
  head: () => ({ meta: [{ title: "Settings — Training | My Florida NEMT" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: LearnSettings,
});

function LearnSettings() {
  const { user } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h2 className="mb-6 text-2xl font-extrabold uppercase tracking-tight">Settings</h2>
      <PersonalSecurity email={user.email ?? null} />
    </div>
  );
}

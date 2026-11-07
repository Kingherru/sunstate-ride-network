import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { AccountPlaceholder } from "@/components/auth/AccountPlaceholder";
import { AuthMessage } from "@/components/auth/AuthShell";
import { btnAction } from "@/components/home/buttons";

export const Route = createFileRoute("/_authenticated/account-setup")({
  head: () => ({ meta: [{ title: "Finish Account Setup — MY FLORIDA NEMT" }, { name: 'description', content: 'Resume secure MY FLORIDA NEMT account creation.' }, { property: 'og:title', content: 'Finish Account Setup — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Resume your account setup securely.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async () => {
    const access = await getAccessState();
    if (access.destination !== "/account-setup") throw redirect({ to: access.destination });
    return { access };
  },
  component: Setup,
});

function Setup() {
  const { access } = Route.useRouteContext();
  const router = useRouter();
  return (
    <AccountPlaceholder title="Finish Setup">
      <AuthMessage tone="info">
        {access.setupIssue === "organization_required"
          ? "Your organization name is missing, so we couldn't finish setting up your account. Please contact us and we'll help."
          : "We couldn't finish setting up your account yet. Please try again."}
      </AuthMessage>
      <button className={btnAction} onClick={() => router.invalidate()}>TRY AGAIN</button>
      <Link to="/learn" className="text-ds-link underline">Go to my training</Link>
    </AccountPlaceholder>
  );
}

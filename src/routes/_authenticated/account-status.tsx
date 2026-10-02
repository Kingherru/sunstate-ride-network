import { createFileRoute, Link } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { AccountPlaceholder } from "@/components/auth/AccountPlaceholder";

export const Route = createFileRoute("/_authenticated/account-status")({
  head: () => ({ meta: [{ title: "Account Status — MY FLORIDA NEMT" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => ({ access: await getAccessState() }),
  component: Status,
});

function Status() {
  const { access } = Route.useRouteContext();
  const suspended = access.profileSuspended || (access.workspaces.length > 0 && access.workspaces.every((w) => w.status === "suspended"));
  return (
    <AccountPlaceholder title="Account Status">
      <p>{suspended
        ? "Your account access is currently suspended. Please contact us if you think this is a mistake."
        : "You don't have access to that area."}</p>
      {!suspended && <Link to={access.destination} className="font-semibold text-ds-link underline">Continue to your account</Link>}
    </AccountPlaceholder>
  );
}

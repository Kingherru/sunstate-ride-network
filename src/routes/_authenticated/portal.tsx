import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { AccountPlaceholder } from "@/components/auth/AccountPlaceholder";

const LABEL: Record<string, string> = { private_pay: "Private Pay", facility: "Facility", hospital: "Hospital", provider: "Provider" };

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Portal — MY FLORIDA NEMT" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const access = await getAccessState();
    if (!access.isAdmin && access.destination !== "/portal") throw redirect({ to: access.destination });
    return { access };
  },
  component: Portal,
});

function Portal() {
  const { user, access } = Route.useRouteContext();
  const ws = access.workspaces[0];
  return (
    <AccountPlaceholder title="Portal">
      <p>Signed in as {user.email}.</p>
      {ws && <p>{LABEL[ws.type] ?? ws.type} account · {ws.status === "pending" ? "Pending review" : "Active"}</p>}
      <p className="text-ds-text-2">Your portal is being built. Check back soon.</p>
    </AccountPlaceholder>
  );
}

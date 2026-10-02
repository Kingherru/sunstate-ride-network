import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAccessState } from "@/lib/access.functions";
import { AccountPlaceholder } from "@/components/auth/AccountPlaceholder";

// Placeholder admin area. Access is verified on the server; real admin data
// must also verify the admin role inside each server function.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — MY FLORIDA NEMT" }, { name: "robots", content: "noindex" }] }),
  beforeLoad: async () => {
    const access = await getAccessState();
    if (!access.isAdmin) throw redirect({ to: "/account-status" });
  },
  component: () => (
    <AccountPlaceholder title="Admin">
      <p className="text-ds-text-2">The admin area is being rebuilt.</p>
    </AccountPlaceholder>
  ),
});

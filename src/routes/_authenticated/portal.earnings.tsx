import { createFileRoute } from "@tanstack/react-router";
import { EarningsPayments } from "@/components/portal/EarningsPayments";
import { PageHead } from "@/components/portal/PortalShell";
export const Route = createFileRoute("/_authenticated/portal/earnings")({
  head: () => ({ meta: [{ title: "Earnings & Payments — MY FLORIDA NEMT" }, { name: "description", content: "Review authorized driver earnings, provider balances, payments and payout history." }, { property: "og:title", content: "Earnings & Payments — MY FLORIDA NEMT" }, { property: "og:description", content: "Review authorized earnings, payments and payout history." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: Earnings,
});
function Earnings() {
  const { user, access } = Route.useRouteContext();
  const allowed = access.primary?.type === "provider" && access.primary.role === "owner" && access.workspaces.length === 1;
  return <><PageHead title="Earnings & Payments" />{allowed ? <EarningsPayments userId={user.id} /> : <p className="ds-body">Financial records require an authorized provider owner account. Team financial access is not available here.</p>}</>;
}
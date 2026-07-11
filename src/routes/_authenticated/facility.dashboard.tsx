import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/facility/dashboard")({
  head: () => ({
    meta: [
      { title: "Facility Dashboard — My Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <DashboardPage portalOverride="facility" />,
});

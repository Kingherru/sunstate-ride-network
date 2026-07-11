import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/provider/dashboard")({
  head: () => ({
    meta: [
      { title: "Provider Dashboard — My Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <DashboardPage portalOverride="provider" />,
});

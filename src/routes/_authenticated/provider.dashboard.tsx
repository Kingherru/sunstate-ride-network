import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/provider/dashboard")({
  head: () => ({
    meta: [
      { title: "Provider Dashboard — MyFloridaNemt.com" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <DashboardPage portalOverride="provider" />,
});

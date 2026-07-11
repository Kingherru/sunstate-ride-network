import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "./dashboard";

export const Route = createFileRoute("/_authenticated/patient/dashboard")({
  head: () => ({
    meta: [
      { title: "Patient Dashboard — My Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <DashboardPage portalOverride="patient" />,
});

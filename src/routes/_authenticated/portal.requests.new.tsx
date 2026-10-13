import { createFileRoute } from "@tanstack/react-router";
import { RequestForm } from "@/components/requests/RequestForm";

export const Route = createFileRoute("/_authenticated/portal/requests/new")({
  head: () => ({ meta: [{ title: "New Request — MY FLORIDA NEMT Portal" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: () => <RequestForm context="portal" />,
});

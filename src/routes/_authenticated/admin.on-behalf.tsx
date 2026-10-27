import { createFileRoute, redirect } from "@tanstack/react-router";

// Merged into Admin Requests → "New for a customer" tab.
export const Route = createFileRoute("/_authenticated/admin/on-behalf")({
  beforeLoad: () => { throw redirect({ to: "/admin/requests", search: { tab: "new" } }); },
});

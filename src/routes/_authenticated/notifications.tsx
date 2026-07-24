import { createFileRoute, redirect } from "@tanstack/react-router";

// The Notifications feature is now embedded in each portal's sidebar.
// This route redirects any legacy /notifications link to the portal
// dashboard, where the notifications tab lives.
export const Route = createFileRoute("/_authenticated/notifications")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});

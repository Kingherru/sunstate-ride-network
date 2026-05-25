import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/service-areas")({
  component: () => <Outlet />,
});

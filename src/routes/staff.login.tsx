import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/staff/login")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — My Florida NEMT" },
      { name: "description", content: "My Florida NEMT staff and dispatcher sign in." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { mode?: "signup" } =>
    s.mode === "signup" ? { mode: "signup" } : {},
  component: PortalAuthPage,
});

function PortalAuthPage() {
  const { mode } = Route.useSearch();
  return <PortalAuth kind="staff" initialMode={mode ?? "signin"} />;
}

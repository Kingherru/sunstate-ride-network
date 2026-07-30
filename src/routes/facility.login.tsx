import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/facility/login")({
  head: () => ({
    meta: [
      { title: "Facility Portal Sign In — My Florida NEMT" },
      { name: "description", content: "Hospitals, SNFs, ALFs, APD providers and case managers — manage transportation for many patients." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? ("signup" as const) : undefined,
  }),
  component: PortalAuthPage,
});

function PortalAuthPage() {
  const { mode } = Route.useSearch();
  return <PortalAuth kind="facility" initialMode={mode ?? "signin"} />;
}

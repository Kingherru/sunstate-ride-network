import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/patient/login")({
  head: () => ({
    meta: [
      { title: "Patient Portal Sign In — My Florida NEMT" },
      { name: "description", content: "Patients, families and caregivers — sign in to book and track Florida medical transportation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s.mode === "signup" ? ("signup" as const) : ("signin" as const),
  }),
  component: PortalAuthPage,
});

function PortalAuthPage() {
  const { mode } = Route.useSearch();
  return <PortalAuth kind="patient" initialMode={mode} />;
}

import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/patient/login")({
  head: () => ({
    meta: [
      { title: "Patient Portal Sign In — Florida NEMT" },
      { name: "description", content: "Patients, families and caregivers — sign in to book and track Florida medical transportation." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PortalAuth kind="patient" />,
});

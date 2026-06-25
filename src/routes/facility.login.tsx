import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/facility/login")({
  head: () => ({
    meta: [
      { title: "Facility Portal Sign In — FloridaNEMT" },
      { name: "description", content: "Hospitals, SNFs, ALFs, APD providers and case managers — manage transportation for many patients." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PortalAuth kind="facility" />,
});

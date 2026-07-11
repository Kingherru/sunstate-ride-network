import { createFileRoute } from "@tanstack/react-router";
import { PortalAuth } from "@/components/auth/PortalAuth";

export const Route = createFileRoute("/provider/login")({
  head: () => ({
    meta: [
      { title: "Provider Portal Sign In — My Florida NEMT" },
      { name: "description", content: "NEMT providers, dispatchers, and transportation companies — sign in to dispatch and bill." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => <PortalAuth kind="provider" />,
});

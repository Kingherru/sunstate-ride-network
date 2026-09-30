import { createFileRoute } from "@tanstack/react-router";
import { TempDestination } from "@/components/public/TempDestination";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "Join the Provider Network — My Florida NEMT" },
      { name: "description", content: "Join the My Florida NEMT provider network. Free for 30 days, then $10 per month." },
      { property: "og:title", content: "Join the Provider Network — My Florida NEMT" },
      { property: "og:description", content: "Join the My Florida NEMT provider network. Free for 30 days, then $10 per month." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <TempDestination
      title="Join the Provider Network"
      intro="Provider sign-up is being rebuilt. Email us your company name, the counties you serve and your service types (ambulatory, wheelchair, stretcher, medical delivery), and we’ll reach out when enrollment opens. Try the complete provider network free for 30 days; after that membership is $10 per month."
      subject="Provider network interest"
    />
  ),
});

import { createFileRoute } from "@tanstack/react-router";
import { TempDestination } from "@/components/public/TempDestination";

export const Route = createFileRoute("/book")({
  head: () => ({
    meta: [
      { title: "Book a Trip — My Florida NEMT" },
      { name: "description", content: "Request non-emergency medical transportation in Florida through My Florida NEMT." },
      { property: "og:title", content: "Book a Trip — My Florida NEMT" },
      { property: "og:description", content: "Request non-emergency medical transportation in Florida through My Florida NEMT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <TempDestination
      title="Book a Trip"
      intro="Our online trip request form is being rebuilt. For now, email us the pickup address, destination, date and time, and whether the rider needs ambulatory, wheelchair or stretcher transportation, and we’ll help you find a provider."
      subject="Trip request"
    />
  ),
});

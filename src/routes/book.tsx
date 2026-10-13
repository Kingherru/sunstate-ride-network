import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { PublicPage } from "@/components/public/PublicPage";
import { pageHead } from "@/components/public/page-kit";
import { RequestForm } from "@/components/requests/RequestForm";

export const Route = createFileRoute("/book")({
  validateSearch: (s: Record<string, unknown>) =>
    z.object({ service: z.string().max(40).optional().catch(undefined) }).parse(s),
  head: () => pageHead(
    "/book",
    "Submit a Florida NEMT Trip Request — Book a Trip | MY FLORIDA NEMT",
    "Request ambulatory, wheelchair or stretcher non-emergency medical transportation in Florida. Participating independent providers review each request; acceptance is required.",
    "Book a Trip",
  ),
  component: BookPage,
});

function BookPage() {
  const { service } = Route.useSearch();
  return <PublicPage><RequestForm context="public" initialService={service} /></PublicPage>;
}

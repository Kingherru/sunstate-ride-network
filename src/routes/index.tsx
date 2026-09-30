import { createFileRoute } from "@tanstack/react-router";
import { BrandName } from "@/components/brand/BrandName";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Florida NEMT — Rebuild in Progress" },
      { name: "description", content: "The My Florida NEMT website is being rebuilt. Please check back soon." },
      { property: "og:title", content: "My Florida NEMT — Rebuild in Progress" },
      { property: "og:description", content: "The My Florida NEMT website is being rebuilt. Please check back soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <section className="p-10 max-w-2xl mx-auto text-center">
      <h1 className="text-3xl"><span className="theme-public"><BrandName /></span></h1>
      <p className="mt-4">The My Florida NEMT rebuild is in progress.</p>
    </section>
  );
}

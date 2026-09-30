import { createFileRoute } from "@tanstack/react-router";

// Placeholder for the future admin area. Shows no data; real admin screens
// must verify the admin role on the server before returning anything.
export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — My Florida NEMT" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <section className="p-10 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="mt-2">The admin area is being rebuilt.</p>
    </section>
  ),
});

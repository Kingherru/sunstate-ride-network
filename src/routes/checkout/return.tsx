import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout/return")({
  head: () => ({
    meta: [
      { title: "Checkout complete — My Florida NEMT" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: CheckoutReturn,
});

function CheckoutReturn() {
  const { session_id } = Route.useSearch();
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <div className="inline-block w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-4xl font-extrabold tracking-tighter mb-3">You're a My Florida NEMT Member</h1>
      <p className="text-muted-foreground mb-2">Your My Florida NEMT membership is active.</p>
      {session_id && <p className="text-xs font-mono text-muted-foreground mb-8 break-all">Receipt: {session_id}</p>}
      <Link
        to="/dashboard"
        className="inline-block text-sm font-bold text-primary-foreground bg-primary px-6 py-3 rounded-sm hover:bg-primary/90"
      >
        Open Dashboard
      </Link>
    </div>
  );
}

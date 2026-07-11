import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { claimEnrollmentFromSession } from "@/lib/courses.functions";

export const Route = createFileRoute("/shop/return")({
  validateSearch: (s: Record<string, unknown>) => ({
    session_id: typeof s.session_id === "string" ? s.session_id : undefined,
    course: typeof s.course === "string" ? s.course : undefined,
  }),
  head: () => ({ meta: [{ title: "Purchase Complete | MyFloridaNemt.com" }, { name: "robots", content: "noindex" }] }),
  component: Return,
});

function Return() {
  const { session_id, course } = Route.useSearch();
  const [state, setState] = useState<"pending" | "ok" | "signin">("pending");

  useEffect(() => {
    if (!session_id || !course) { setState("ok"); return; }
    claimEnrollmentFromSession({ data: { sessionId: session_id, slug: course } })
      .then(() => setState("ok"))
      .catch(() => setState("signin"));
  }, [session_id, course]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto px-4 py-16 text-center">
        <CheckCircle2 className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-extrabold mb-3">Thank you for your purchase</h1>
        <p className="text-muted-foreground mb-8">
          {state === "pending" && "Finalizing your enrollment…"}
          {state === "ok" && "Your enrollment is ready. You can start your course now."}
          {state === "signin" && "Sign in to access your course. Your purchase is saved to your email."}
        </p>
        <div className="flex gap-3 justify-center">
          {course && state === "ok" && (
            <Button asChild><Link to="/learn/$slug" params={{ slug: course }}>Start course</Link></Button>
          )}
          <Button variant="outline" asChild><Link to="/learn">My courses</Link></Button>
        </div>
      </main>
      <Footer />
    </div>
  );
}

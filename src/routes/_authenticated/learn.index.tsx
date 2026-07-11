import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyEnrollments } from "@/lib/courses.functions";
import { Button } from "@/components/ui/button";
import { Award, BookOpen, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn/")({
  head: () => ({ meta: [{ title: "My Courses | MyFloridaNemt.com" }, { name: "robots", content: "noindex" }] }),
  component: LearnIndex,
});

function LearnIndex() {
  const { data: enrollments, isLoading } = useQuery({ queryKey: ["my-enrollments"], queryFn: () => listMyEnrollments() });
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-extrabold mb-6 flex items-center gap-2"><BookOpen className="w-7 h-7" />My Courses</h1>
      {isLoading ? <p>Loading…</p> : (enrollments?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-muted-foreground mb-4">You haven't enrolled in any courses yet.</p>
          <Button asChild><Link to="/shop">Browse the training shop</Link></Button>
        </div>
      ) : (
        <div className="space-y-4">
          {enrollments!.map((e) => {
            const c = e.courses as { slug: string; title: string; summary: string; duration_min: number };
            return (
              <Link key={e.id} to="/learn/$slug" params={{ slug: c.slug }} className="block border border-border rounded-lg p-5 hover:border-primary transition bg-card">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-bold text-lg">{c.title}</h2>
                    <p className="text-sm text-muted-foreground">{c.summary}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {e.status === "completed" ? (
                      <span className="text-sm text-primary flex items-center gap-1"><Award className="w-4 h-4" />Completed</span>
                    ) : (
                      <span className="text-sm text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />In progress</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

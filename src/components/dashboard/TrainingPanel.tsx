import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listMyEnrollments } from "@/lib/courses.functions";
import { Button } from "@/components/ui/button";
import { Award, BookOpen, CheckCircle2, ExternalLink } from "lucide-react";

export function TrainingPanel() {
  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: () => listMyEnrollments(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Training & Tests
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Complete required HIPAA and Florida NEMT certifications. Certificates are issued automatically on passing.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/shop">
            Browse Course Catalog <ExternalLink className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (enrollments?.length ?? 0) === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <p className="text-muted-foreground mb-4">
            You haven't enrolled in any training courses yet.
          </p>
          <Button asChild>
            <Link to="/shop">Browse the Training Shop</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {enrollments!.map((e) => {
            const c = e.courses as { slug: string; title: string; summary: string; duration_min: number };
            return (
              <Link
                key={e.id}
                to="/learn/$slug"
                params={{ slug: c.slug }}
                className="block border border-border rounded-lg p-5 hover:border-primary transition bg-card"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold">{c.title}</h3>
                    <p className="text-sm text-muted-foreground">{c.summary}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {e.status === "completed" ? (
                      <span className="text-sm text-primary flex items-center gap-1">
                        <Award className="w-4 h-4" />
                        Completed
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        In progress
                      </span>
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

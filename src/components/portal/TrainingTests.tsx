import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, BookOpen, PlayCircle, ShoppingBag } from "lucide-react";
import { listPublicCourses, listMyEnrollments } from "@/lib/courses.functions";
import { DsEmpty } from "@/components/ds/feedback";
import { actionCls, panelCls } from "@/components/portal/PortalShell";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";

const price = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Real courses + the signed-in learner's own enrollments. No invented progress. */
export function TrainingTests() {
  const preview = usePortalPreview();
  const courses = usePortalQuery({ queryKey: ["public-courses"], queryFn: () => listPublicCourses() });
  const mine = usePortalQuery({ queryKey: ["my-enrollments"], queryFn: () => listMyEnrollments() });

  if (courses.isLoading || mine.isLoading) return <p className="ds-support" role="status">Loading training…</p>;
  if (courses.error) return <DsEmpty title="Training is unavailable">Please try again in a moment.</DsEmpty>;
  const byCourse = new Map((mine.data ?? []).map((e) => [e.course_id, e]));

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(courses.data ?? []).map((c) => {
        const e = byCourse.get(c.id);
        const done = e?.status === "completed";
        const pct = Math.max(0, Math.min(100, Math.round(Number(e?.progress ?? 0))));
        return (
          <article key={c.id} className={`${panelCls} flex flex-col p-5 sm:p-6`}>
            <div className="flex items-start gap-3">
              <BookOpen className="mt-1 size-5 shrink-0 text-ds-primary" aria-hidden />
              <div className="min-w-0">
                <h2 className="ds-subheading text-ds-primary">{c.title}</h2>
                <p className="ds-support mt-1">{c.duration_min} min · {e ? (done ? "Completed" : "Purchased") : `${price(c.price_cents)} per course`}</p>
              </div>
            </div>
            {c.summary && <p className="ds-body mt-3 text-ds-text-2">{c.summary}</p>}
            {e && !done && (
              <div className="mt-4" aria-label={`Progress ${pct}%`}>
                <div className="h-2 w-full rounded-ds-sm bg-ds-subtle"><div className="h-2 rounded-ds-sm bg-ds-action" style={{ width: `${pct}%` }} /></div>
                <p className="ds-support mt-1">{pct}% complete</p>
              </div>
            )}
            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              {e ? (
                <Link to="/learn/$slug" params={{ slug: c.slug }} className={actionCls}>
                  {done ? <><Award className="mr-2 size-4" aria-hidden />View certificate</> : <><PlayCircle className="mr-2 size-4" aria-hidden />Continue course</>}
                </Link>
              ) : preview.active ? (
                <button type="button" onClick={previewBlocked} className={actionCls}>
                  <ShoppingBag className="mr-2 size-4" aria-hidden />Buy course
                </button>
              ) : (
                <Link to="/shop/$slug" params={{ slug: c.slug }} className={actionCls}>
                  <ShoppingBag className="mr-2 size-4" aria-hidden />Buy course
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

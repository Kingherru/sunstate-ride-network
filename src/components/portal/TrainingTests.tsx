import { Link } from "@tanstack/react-router";
import { useState } from 'react';
import { Award, BookOpen, PlayCircle, ShoppingBag } from "lucide-react";
import { listPublicCourses, listMyEnrollments } from "@/lib/courses.functions";
import { DsEmpty } from "@/components/ds/feedback";
import { actionCls, panelCls } from "@/components/portal/PortalShell";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import { DsButton } from '@/components/ds/controls';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { BasicNemtReading } from '@/components/training/BasicNemtReading';
import { useTrainingCart } from '@/components/training/TrainingCart';

const price = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Real courses + the signed-in learner's own enrollments. No invented progress. */
export function TrainingTests() {
  const preview = usePortalPreview();
  const cart = useTrainingCart();
  const [tab, setTab] = useState('Available Training');
  const [materials, setMaterials] = useState(false);
  const courses = usePortalQuery({ queryKey: ["public-courses"], queryFn: () => listPublicCourses() });
  const mine = usePortalQuery({ queryKey: ["my-enrollments"], queryFn: () => listMyEnrollments() });

  if (courses.isLoading || mine.isLoading) return <p className="ds-support" role="status">Loading training…</p>;
  if (courses.error || mine.error) return <DsEmpty title="Training is unavailable">Please try again in a moment.</DsEmpty>;
  if (!courses.data?.length) return <DsEmpty title="No courses available right now">Your existing purchases and certificates remain in your learner area.</DsEmpty>;
  const byCourse = new Map((mine.data ?? []).map((e) => [e.course_id, e]));
  const tabs = ['Available Training', 'Available Tests', 'Tests to Take', 'In Progress', 'Completed Tests'];
  const rows = (courses.data ?? []).filter(c => {
    const e = byCourse.get(c.id);
    if (tab === 'Tests to Take') return !!e && e.status !== 'completed';
    if (tab === 'In Progress') return !!e && e.status !== 'completed';
    if (tab === 'Completed Tests') return e?.status === 'completed';
    return true;
  });

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Training views" className="flex flex-wrap gap-2">{tabs.map(t => <DsButton key={t} role="tab" aria-selected={tab === t} variant={tab === t ? 'secondary' : 'ghost'} size="sm" onClick={() => setTab(t)}>{t}</DsButton>)}</div>
      {!rows.length && <DsEmpty title={tab === 'Completed Tests' ? 'No completed tests yet' : 'No courses in this view'} />}
      <div className="grid gap-5 md:grid-cols-2">
      {rows.map((c) => {
        const e = byCourse.get(c.id);
        const done = e?.status === "completed";
        const progress = e?.progress;
        const pct = typeof progress === 'number' ? Math.max(0, Math.min(100, Math.round(progress))) : null;
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
            <p className="ds-support mt-2">Passing score: {c.passing_score}% · Certificate: {c.cert_validity_months} months</p>
            {e && !done && pct !== null && (
              <div className="mt-4" aria-label={`Progress ${pct}%`}>
                <div className="h-2 w-full rounded-ds-sm bg-ds-subtle"><div className="h-2 rounded-ds-sm bg-ds-action" style={{ width: `${pct}%` }} /></div>
                <p className="ds-support mt-1">{pct}% complete</p>
              </div>
            )}
            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              {e ? (
                <Link to="/learn/$slug" params={{ slug: c.slug }} onClick={event => { if (preview.active) { event.preventDefault(); previewBlocked(); } }} className={actionCls}>
                  {done ? <><Award className="mr-2 size-4" aria-hidden />View certificate</> : <><PlayCircle className="mr-2 size-4" aria-hidden />Continue course</>}
                </Link>
              ) : preview.active ? (
                <DsButton type="button" onClick={previewBlocked} className={actionCls}>
                  <ShoppingBag className="mr-2 size-4" aria-hidden />Buy course
                </DsButton>
              ) : (
                c.price_id ? <DsButton className={actionCls} onClick={() => cart.add(c, (mine.data ?? []).map(e => e.course_id))} disabled={cart.items.some(i => i.id === c.id)}><ShoppingBag className="size-4" />{cart.items.some(i => i.id === c.id) ? 'In cart' : 'Add to cart'}</DsButton> : <p className="ds-support">Requires product setup</p>
              )}
              <Link to="/shop/$slug" params={{ slug: c.slug }} className="ds-label text-ds-link underline">Course & test details</Link>
              {c.slug === 'nemt-certification' && <DsButton variant="ghost" size="sm" onClick={() => setMaterials(true)}><BookOpen className="size-4" />Training materials</DsButton>}
            </div>
          </article>
        );
      })}
      </div>
      {(mine.data ?? []).filter(e => !byCourse.has(e.course_id) || !(courses.data ?? []).some(c => c.id === e.course_id)).map(e => <Link key={e.id} to="/learn/$slug" params={{ slug: e.courses.slug }} className="block ds-label text-ds-link underline">{e.courses.title} — {e.status}</Link>)}
      <Dialog open={materials} onOpenChange={setMaterials}><DialogContent className="theme-portal !max-w-3xl max-h-[90dvh] overflow-y-auto"><DialogTitle className="pr-8 text-ds-primary">Florida Basic NEMT Test — Training materials</DialogTitle><DialogDescription className="sr-only">Original course reading</DialogDescription><BasicNemtReading /></DialogContent></Dialog>
    </div>
  );
}

import { Link } from "@tanstack/react-router";
import { useState } from 'react';
import { Award, BookOpen, PlayCircle, ShoppingBag } from "lucide-react";
import { listPublicCourses, listMyEnrollments } from "@/lib/courses.functions";
import { DsEmpty } from "@/components/ds/feedback";
import { actionCls, panelCls } from "@/components/portal/PortalShell";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import { DsButton } from '@/components/ds/controls';
import { useTrainingCart } from '@/components/training/TrainingCart';
import { PortalTabbedLayout } from './PortalTabbedLayout';
import {ResourceViewer} from '@/components/training/ResourceViewer';

const price = (c: number) => `$${(c / 100).toFixed(0)}`;

/** Real courses + the signed-in learner's own enrollments. No invented progress. */
export function TrainingTests() {
  const preview = usePortalPreview();
  const cart = useTrainingCart();
  const [tab, setTab] = useState('Available');
  const [resourceView, setResourceView] = useState('resources');
  const [viewer,setViewer]=useState(false);
  const courses = usePortalQuery({ queryKey: ["public-courses"], queryFn: () => listPublicCourses() });
  const mine = usePortalQuery({ queryKey: ["my-enrollments"], queryFn: () => listMyEnrollments() });

  if (courses.isLoading || mine.isLoading) return <p className="ds-support" role="status">Loading training…</p>;
  if (courses.error || mine.error) return <DsEmpty title="Training is unavailable">Please try again in a moment.</DsEmpty>;
  if (!courses.data?.length && !mine.data?.length) return <DsEmpty title="No courses available right now">Your existing purchases and certificates remain in your learner area.</DsEmpty>;
  const byCourse = new Map((mine.data ?? []).map((e) => [e.course_id, e]));
  // Each view has one purpose: Available = not yet purchased; Tests to Take = purchased, not started;
  // In Progress = purchased with recorded progress; Completed Tests = certificate earned.
  const tabs = ['Available', 'In Progress', 'Completed', 'Purchases & Resources'];
  const rows = (courses.data ?? []).filter(c => {
    const e = byCourse.get(c.id);
    if (tab === 'Available') return !e;
    if (tab === 'Purchases & Resources') return resourceView === 'resources' && !!e && c.product_kind === 'digital_guide';
    if (c.product_kind === 'digital_guide') return false;
    if (tab === 'In Progress') return !!e && e.status !== 'completed';
    return e?.status === 'completed';
  });

  return (
    <div className="space-y-5">
      {viewer&&<ResourceViewer preview={preview.active} onClose={()=>setViewer(false)}/>}

      <PortalTabbedLayout label="Training views" queryKey="training" value={tab} onChange={setTab} options={tabs.map(value => ({ value, label: value }))} >
      {tab === 'Purchases & Resources' && <div className="portal-toolbar"><DsButton variant={resourceView === 'resources' ? 'secondary' : 'ghost'} onClick={() => setResourceView('resources')}>PDFs & Guides</DsButton><DsButton variant={resourceView === 'history' ? 'secondary' : 'ghost'} onClick={() => setResourceView('history')}>Purchase history</DsButton>{preview.active && <DsButton size="sm" variant="ghost" onClick={() => setViewer(true)}>Preview resource</DsButton>}</div>}
      {tab==='Purchases & Resources' && resourceView === 'history' &&<ul className="divide-y divide-ds-border">{mine.data?.map(e=><li key={e.id} className="py-4"><p className="ds-label text-ds-primary">{e.courses.title}</p><p className="ds-support">{e.status} · {e.purchased_at?new Date(e.purchased_at).toLocaleDateString():'Purchase date not available'}</p></li>)}</ul>}
      {!rows.length && <DsEmpty title={tab === 'Completed Tests' ? 'No completed tests yet' : tab === 'Available' ? 'You own every available course' : 'No courses in this view'} />}
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
                <p className="ds-support mt-1">{c.product_kind==='digital_guide'?'PDF digital guide':`${c.duration_min} min`} · {e ? (done ? "Completed" : "Purchased") : `${price(c.price_cents)} one-time`}</p>
              </div>
            </div>
            {c.summary && <p className="ds-body mt-3 text-ds-text-2">{c.summary}</p>}
            {c.product_kind==='digital_guide'?<p className="ds-support mt-2">Educational business resource · No exam or certificate</p>:<p className="ds-support mt-2">Passing score: {c.passing_score}% · Certificate: {c.cert_validity_months} months</p>}
            {e && !done && pct !== null && (
              <div className="mt-4" aria-label={`Progress ${pct}%`}>
                <div className="h-2 w-full rounded-ds-sm bg-ds-subtle"><div className="h-2 rounded-ds-sm bg-ds-action" style={{ width: `${pct}%` }} /></div>
                <p className="ds-support mt-1">{pct}% complete</p>
              </div>
            )}
            <div className="mt-auto flex flex-wrap gap-3 pt-5">
              {e && c.product_kind==='digital_guide'?<><DsButton onClick={()=>setViewer(true)}>Open purchased PDF</DsButton><p className="ds-support">Purchase evidence is checked on every open. Unverified or reversed purchases remain unavailable.</p></>: e ? (
                <Link to="/learn/$slug" params={{ slug: c.slug }} onClick={event => { if (preview.active) { event.preventDefault(); previewBlocked(); } }} className={actionCls}>
                  {done ? <><Award className="mr-2 size-4" aria-hidden />View certificate</> : <><PlayCircle className="mr-2 size-4" aria-hidden />Continue course</>}
                </Link>
              ) : preview.active ? (
                <DsButton type="button" onClick={previewBlocked} className={actionCls}>
                  <ShoppingBag className="mr-2 size-4" aria-hidden />Buy course
                </DsButton>
              ) : (
                <DsButton className={actionCls} onClick={() => cart.add(c, (mine.data ?? []).map(e => e.course_id))} disabled={cart.items.some(i => i.id === c.id)}><ShoppingBag className="size-4" />{cart.items.some(i => i.id === c.id) ? 'In cart' : 'Add to cart'}</DsButton>
              )}
              <Link to="/shop/$slug" params={{ slug: c.slug }} className="ds-label text-ds-link underline">{c.product_kind==='digital_guide'?'Guide details':'Course & test details'}</Link>
            </div>
          </article>
        );
      })}
      </div>
      {(mine.data ?? []).filter(e => !byCourse.has(e.course_id) || !(courses.data ?? []).some(c => c.id === e.course_id)).map(e => <Link key={e.id} to="/learn/$slug" params={{ slug: e.courses.slug }} className="block ds-label text-ds-link underline">{e.courses.title} — {e.status}</Link>)}
    </PortalTabbedLayout>
    </div>
  );
}

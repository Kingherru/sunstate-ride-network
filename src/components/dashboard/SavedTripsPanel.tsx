import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from 'react';
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTripDrafts, deleteTripDraft } from "@/lib/trip-drafts.functions";
import { formatTime12 } from "@/lib/time-format";
import { formatUsDate, partialAddress, pendingBadge } from "@/lib/trip-form-rules";
import { usePortalPreview, usePortalMutation, usePortalQuery, previewBlocked } from "@/components/portal/preview-data";
import { DsButton } from '@/components/ds/controls';
import { DetailOverlayFrame } from '@/components/portal/DetailOverlayFrame';
import { DetailSection } from '@/components/portal/DetailSection';

export type TripDraft = {
  id: string;
  payload: Record<string, any>;
  summary: string | null;
  autosaved: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Saved (unsubmitted) trip drafts.
 *
 * Providers see this as the "Drafts" section of Reservations; patients and
 * facilities see it as the "Saved Trips" tab. Either way the copy makes clear
 * that nothing here has been submitted to a transportation provider yet.
 */
export function SavedTripsPanel({
  onResume,
  variant = "saved",
  compact = false,
}: {
  onResume: (draft: TripDraft) => void;
  variant?: "saved" | "drafts";
  /** Compact Draft-badged rows for the combined Unconfirmed & Drafts section. */
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<TripDraft | null>(null);
  const [examples, setExamples] = useState(true);
  const preview = usePortalPreview();
  const list = useServerFn(listTripDrafts);
  const del = useServerFn(deleteTripDraft);

  const q = usePortalQuery({
    queryKey: ["trip-drafts"],
    queryFn: () => list(),
  });

  const rows = (preview.active && !examples ? [] : q.data ?? []) as TripDraft[];

  async function remove(id: string) {
    if (preview.active) { previewBlocked(); return; }
    if (!confirm("Delete this saved trip? This cannot be undone.")) return;
    try {
      await del({ data: { draft_id: id } });
      toast.success("Saved trip deleted");
      qc.invalidateQueries({ queryKey: ["trip-drafts"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not delete this saved trip");
    }
  }

  if (compact) return (
    <div className="space-y-1" data-compact-drafts>
      {q.isLoading && <p className="ds-support">Loading drafts…</p>}
      {rows.map(d => {
        const p = d.payload ?? {};
        const name = [p.patientFirstName ?? p.patient_first_name, p.patientLastName ?? p.patient_last_name].filter(Boolean).join(" ").trim();
        const date = String(p.pickupDate || p.pickup_date || '');
        return <div key={d.id} data-compact-trip className="trip-compact-row" role="button" tabIndex={0} aria-label={`Open draft ${name || 'trip'}`}
          onClick={e => { if (!(e.target as HTMLElement).closest('button')) setDetail(d); }}
          onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDetail(d); } }}>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><span className="ds-label text-ds-primary">{p.requestCategory === 'medical_delivery' ? 'Medical Delivery' : name || 'Untitled trip draft'}</span><span className="trip-mini-badge bg-ds-sky text-ds-primary">{pendingBadge({ kind: 'draft' }, '')}</span></div>
            <p className="ds-support">{date ? formatUsDate(date) : 'No pickup date'} · {partialAddress(p.pickupCity || p.pickup_city, p.pickupAddress || p.pickup_address)} → {partialAddress(p.dropoffCity || p.dropoff_city, p.dropoffAddress || p.dropoff_address)}</p></div>
          <button type="button" className="trip-compact-action" onClick={() => onResume(d)}>Resume</button>
        </div>;
      })}
      {detail && <DetailOverlayFrame title="Draft — not submitted" onClose={() => setDetail(null)}><div className="space-y-5"><DetailSection title="Draft identity and status"><p>Not submitted · Last saved {new Date(detail.updated_at).toLocaleString()}</p></DetailSection><DetailSection tone="trip" title="Draft trip or delivery details"><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(detail.payload).filter(([key, value]) => !/Id$|token|quote|rate|margin/i.test(key) && ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => <div key={key} className="min-w-0 rounded-ds-sm bg-ds-bg p-3"><dt className="ds-label font-bold text-ds-primary">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd className="ds-body break-words">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) || 'Not Provided'}</dd></div>)}</dl></DetailSection><div className="flex flex-wrap gap-2"><DsButton onClick={() => onResume(detail)}>Resume draft</DsButton><DsButton variant="secondary" disabled={preview.active} onClick={() => { void remove(detail.id); setDetail(null); }}>Delete</DsButton></div></div></DetailOverlayFrame>}
    </div>
  );
  return (
    <div className="space-y-4">
      {preview.active && <DsButton variant="ghost" onClick={() => setExamples(!examples)}>{examples ? 'Remove draft examples' : 'Show draft examples'}</DsButton>}
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">
          {variant === "drafts" ? "Drafts (not submitted)" : "Saved Trips"}
        </h3>
        <p className="text-sm text-foreground/80">
          These trips have <strong>not been submitted yet</strong> — they are saved drafts only. No
          provider has been notified and no reservation exists until you open a draft and submit it.
        </p>
      </div>

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}

      {!q.isLoading && rows.length === 0 && (
        <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
          Nothing saved yet. Start filling in the trip form and your progress is saved here
          when you choose <strong>Save draft</strong> to finish it later.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((d) => {
          const p = d.payload ?? {};
          const name = [p.patientFirstName ?? p.patient_first_name, p.patientLastName ?? p.patient_last_name].filter(Boolean).join(" ").trim();
          return (
            <div
              key={d.id}
              className="min-w-0 border-b border-ds-border py-4 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="ds-status-yellow ds-caption px-2 py-1 rounded-ds-sm">
                    Not submitted
                  </span>
                  {d.autosaved && (
                    <span className="bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                      Auto-saved
                    </span>
                  )}
                </div>
                <div className="ds-label text-ds-primary">{p.requestCategory === 'medical_delivery' ? 'Medical Delivery' : name || 'Untitled trip draft'}</div>
                <p className="ds-support">{d.summary} · {String(p.transportType || p.deliveryCategory || 'Service not selected').replaceAll('_', ' ')} · {String(p.tripType || 'one_way').replaceAll('_', ' ')}</p>
                <div className="text-sm text-muted-foreground mt-1">
                  {p.pickupAddress || p.pickup_address || "No pickup yet"}
                  {p.pickupCity || p.pickup_city ? `, ${p.pickupCity || p.pickup_city}` : ""} → {p.dropoffAddress || p.dropoff_address || "No drop-off yet"}
                  {p.dropoffCity || p.dropoff_city ? `, ${p.dropoffCity || p.dropoff_city}` : ""}
                </div>
                <div className="text-xs text-foreground/80 mt-1">
                  {p.pickupDate || p.pickup_date ? `Pickup ${p.pickupDate || p.pickup_date}` : "No pickup date"}
                  {p.pickupTime || p.pickup_time ? ` at ${formatTime12(String(p.pickupTime || p.pickup_time))}` : ""} · Last saved{" "}
                  {new Date(d.updated_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <DsButton variant="ghost" onClick={() => setDetail(d)}>View draft</DsButton>
                <DsButton
                  type="button"
                  onClick={() => onResume(d)}
                >
                  Resume draft
                </DsButton>
                <DsButton variant="secondary"
                  type="button"
                  disabled={preview.active}
                  onClick={() => remove(d.id)}
                >
                  Delete
                </DsButton>
              </div>
            </div>
          );
        })}
      </div>
      {detail && <DetailOverlayFrame title="Draft — not submitted" onClose={() => setDetail(null)}><div className="space-y-5"><DetailSection title="Draft identity and status"><p>Not submitted · Last saved {new Date(detail.updated_at).toLocaleString()}</p></DetailSection><DetailSection tone="trip" title="Draft trip or delivery details"><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(detail.payload).filter(([key, value]) => !/Id$|token|quote|rate|margin/i.test(key) && ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => <div key={key} className="min-w-0 rounded-ds-sm bg-ds-bg p-3"><dt className="ds-label font-bold text-ds-primary">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd className="ds-body break-words">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value) || 'Not Provided'}</dd></div>)}</dl></DetailSection><DsButton onClick={() => onResume(detail)}>Resume draft</DsButton></div></DetailOverlayFrame>}
    </div>
  );
}

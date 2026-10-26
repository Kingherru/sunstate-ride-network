import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from 'react';
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTripDrafts, deleteTripDraft } from "@/lib/trip-drafts.functions";
import { formatTime12 } from "@/lib/time-format";
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
}: {
  onResume: (draft: TripDraft) => void;
  variant?: "saved" | "drafts";
}) {
  const qc = useQueryClient();
  const [detail, setDetail] = useState<TripDraft | null>(null);
  const preview = usePortalPreview();
  const list = useServerFn(listTripDrafts);
  const del = useServerFn(deleteTripDraft);

  const q = usePortalQuery({
    queryKey: ["trip-drafts"],
    queryFn: () => list(),
  });

  const rows = (q.data ?? []) as TripDraft[];

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

  return (
    <div className="space-y-4">
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
              className="bg-card border border-border border-l-4 border-l-amber-400 rounded-sm p-4 flex items-start justify-between gap-3 flex-wrap"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                    Not submitted
                  </span>
                  {d.autosaved && (
                    <span className="bg-muted text-foreground text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm">
                      Auto-saved
                    </span>
                  )}
                </div>
                <div className="font-extrabold">{name || "Untitled trip draft"}</div>
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
                  onClick={() => { if (preview.active) { previewBlocked(); return; } onResume(d); }}
                >
                  Resume draft
                </DsButton>
                <DsButton variant="secondary"
                  type="button"
                  onClick={() => remove(d.id)}
                >
                  Delete
                </DsButton>
              </div>
            </div>
          );
        })}
      </div>
      {detail && <DetailOverlayFrame title="Draft — not submitted" onClose={() => setDetail(null)}><div className="space-y-5"><DetailSection title="Draft identity and status"><p>Not submitted · Last saved {new Date(detail.updated_at).toLocaleString()}</p></DetailSection><DetailSection tone="trip" title="Draft trip or delivery details"><dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Object.entries(detail.payload).filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value)).map(([key, value]) => <div key={key} className="min-w-0"><dt className="ds-label uppercase">{key.replace(/([A-Z])/g, ' $1').replaceAll('_', ' ')}</dt><dd className="ds-body break-words">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : /^\d{4}-\d{2}-\d{2}/.test(String(value)) ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString() : String(value) || 'NOT PROVIDED'}</dd></div>)}</dl></DetailSection><DsButton onClick={() => { if (preview.active) { previewBlocked(); return; } onResume(detail); }}>Edit draft</DsButton></div></DetailOverlayFrame>}
    </div>
  );
}

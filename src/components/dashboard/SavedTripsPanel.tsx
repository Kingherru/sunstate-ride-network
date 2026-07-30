import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listTripDrafts, deleteTripDraft } from "@/lib/trip-drafts.functions";
import { formatTime12 } from "@/lib/time-format";

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
  const list = useServerFn(listTripDrafts);
  const del = useServerFn(deleteTripDraft);

  const q = useQuery({
    queryKey: ["trip-drafts"],
    queryFn: () => list(),
  });

  const rows = (q.data ?? []) as TripDraft[];

  async function remove(id: string) {
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
          automatically, or use <strong>Save trip</strong> to finish it later.
        </div>
      )}

      <div className="space-y-3">
        {rows.map((d) => {
          const p = d.payload ?? {};
          const name = [p.patient_first_name, p.patient_last_name].filter(Boolean).join(" ").trim();
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
                  {p.pickup_address || "No pickup yet"}
                  {p.pickup_city ? `, ${p.pickup_city}` : ""} → {p.dropoff_address || "No drop-off yet"}
                  {p.dropoff_city ? `, ${p.dropoff_city}` : ""}
                </div>
                <div className="text-xs text-foreground/80 mt-1">
                  {p.pickup_date ? `Pickup ${p.pickup_date}` : "No pickup date"}
                  {p.pickup_time ? ` at ${formatTime12(String(p.pickup_time))}` : ""} · Last saved{" "}
                  {new Date(d.updated_at).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onResume(d)}
                  className="text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-sm hover:bg-primary/90"
                >
                  Continue &amp; submit
                </button>
                <button
                  type="button"
                  onClick={() => remove(d.id)}
                  className="text-xs font-bold border border-border px-3 py-2 rounded-sm hover:bg-muted"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

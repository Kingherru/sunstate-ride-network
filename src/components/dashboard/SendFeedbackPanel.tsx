import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

type Trip = {
  id: string;
  status: string | null;
  assigned_to: string | null;
  created_at: string;
  pickup_address: string | null;
  dropoff_address: string | null;
  pickup_date: string | null;
};

type ExistingRating = {
  id: string;
  trip_id: string;
  overall: number;
  comment: string | null;
};

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // 10 half-steps: click left half for x.5, right half for x.0
  return (
    <div className="flex gap-1 text-3xl select-none">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <div key={n} className="relative w-8 h-8 leading-none">
            <span className={filled ? "text-amber-500" : half ? "text-muted-foreground/30" : "text-muted-foreground/30"}>
              ★
            </span>
            {half && (
              <span className="absolute inset-0 overflow-hidden text-amber-500" style={{ width: "50%" }}>
                ★
              </span>
            )}
            <button
              type="button"
              aria-label={`${n - 0.5} stars`}
              onClick={() => onChange(n - 0.5)}
              className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
            />
            <button
              type="button"
              aria-label={`${n} stars`}
              onClick={() => onChange(n)}
              className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
            />
          </div>
        );
      })}
      <span className="ml-2 text-sm font-mono text-muted-foreground self-center">{value.toFixed(1)}</span>
    </div>
  );
}

export function SendFeedbackPanel() {
  const [uid, setUid] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [ratings, setRatings] = useState<Record<string, ExistingRating>>({});
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id ?? null;
      setUid(userId);
      if (!userId) return;
      const { data, error } = await supabase
        .from("trips")
        .select("id, status, assigned_to, created_at, pickup_address, dropoff_address, pickup_at")
        .eq("created_by", userId)
        .in("status", ["completed", "accepted", "assigned"])
        .not("assigned_to", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); return; }
      const list = (data ?? []) as Trip[];
      setTrips(list);
      if (list.length > 0) {
        const ids = list.map((t) => t.id);
        const { data: rs } = await supabase
          .from("provider_ratings")
          .select("id, trip_id, overall, comment")
          .in("trip_id", ids)
          .eq("rater_id", userId);
        const map: Record<string, ExistingRating> = {};
        for (const r of (rs ?? []) as ExistingRating[]) map[r.trip_id] = r;
        setRatings(map);
      }
    })();
  }, []);

  const selected = useMemo(() => trips?.find((t) => t.id === selectedTripId) ?? null, [trips, selectedTripId]);

  // Preload existing rating when a trip is picked
  useEffect(() => {
    if (!selectedTripId) return;
    const existing = ratings[selectedTripId];
    if (existing) {
      setStars(Number(existing.overall));
      setComment(existing.comment ?? "");
    } else {
      setStars(5);
      setComment("");
    }
  }, [selectedTripId, ratings]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid || !selected || !selected.assigned_to) return;
    if (stars < 0.5 || stars > 5 || (stars * 2) % 1 !== 0) {
      toast.error("Please pick a rating from 0.5 to 5 stars");
      return;
    }
    setBusy(true);
    try {
      const existing = ratings[selected.id];
      const payload = {
        provider_id: selected.assigned_to,
        trip_id: selected.id,
        rater_id: uid,
        overall: stars,
        comment: comment.trim() || null,
      };
      const q = existing
        ? supabase.from("provider_ratings").update(payload).eq("id", existing.id).select("id, trip_id, overall, comment").single()
        : supabase.from("provider_ratings").insert(payload).select("id, trip_id, overall, comment").single();
      const { data, error } = await q;
      if (error) throw error;
      if (data) setRatings((prev) => ({ ...prev, [selected.id]: data as ExistingRating }));
      toast.success(existing ? "Feedback updated" : "Thanks for your feedback");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save feedback");
    } finally {
      setBusy(false);
    }
  }

  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!trips) return <div className="p-6 text-sm text-muted-foreground">Loading your trips…</div>;

  if (trips.length === 0) {
    return (
      <div className="bg-secondary border border-border p-8 text-sm text-muted-foreground text-center">
        You have no trips with an assigned provider yet. Once a provider accepts a trip, you can leave feedback here.
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6">
      <form onSubmit={submit} className="bg-card border border-border p-6 space-y-5">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Trip
          </label>
          <select
            value={selectedTripId}
            onChange={(e) => setSelectedTripId(e.target.value)}
            className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background"
          >
            <option value="">Choose a trip…</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {new Date(t.pickup_at ?? t.created_at).toLocaleDateString()} · {t.pickup_address ?? "Pickup"} → {t.dropoff_address ?? "Dropoff"}
                {ratings[t.id] ? "  (rated)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Rating (half-stars allowed)
          </label>
          <StarPicker value={stars} onChange={setStars} />
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Comments
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            maxLength={1000}
            placeholder="How was the driver? On-time, courteous, safe, clean vehicle…"
            className="w-full border border-border rounded-sm px-3 py-2 text-sm bg-background"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !selectedTripId}
            className="portal-btn-primary px-6 py-2 disabled:opacity-50"
          >
            {busy ? "Saving…" : ratings[selectedTripId] ? "Update feedback" : "Send feedback"}
          </button>
        </div>
      </form>

      <aside className="bg-secondary border border-border p-5 text-sm text-muted-foreground space-y-3">
        <h3 className="font-bold text-brand text-base">About feedback</h3>
        <p>Your rating helps us match riders with reliable providers. You can edit any rating from this tab.</p>
        <p>Rate on a 1–5 scale in half-star increments and add a short comment if you'd like.</p>
      </aside>
    </div>
  );
}

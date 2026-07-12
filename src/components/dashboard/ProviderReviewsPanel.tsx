import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type Review = {
  id: string;
  overall: number;
  comment: string | null;
  created_at: string;
  trip_id: string;
  rater_id: string;
};

function StarDisplay({ value }: { value: number }) {
  const full = Math.floor(value);
  const half = value - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);
  return (
    <span className="text-amber-500 text-lg leading-none" aria-label={`${value} out of 5`}>
      {"★".repeat(full)}
      {half && <span className="relative inline-block">
        <span className="text-muted-foreground/30">★</span>
        <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>★</span>
      </span>}
      <span className="text-muted-foreground/30">{"★".repeat(empty)}</span>
    </span>
  );
}

export function ProviderReviewsPanel() {
  const [rows, setRows] = useState<Review[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const { data, error } = await supabase
        .from("provider_ratings")
        .select("id, overall, comment, created_at, trip_id, rater_id")
        .eq("provider_id", uid)
        .order("created_at", { ascending: false });
      if (error) setErr(error.message);
      else setRows((data ?? []) as Review[]);
    })();
  }, []);

  const summary = useMemo(() => {
    if (!rows || rows.length === 0) return null;
    const avg = rows.reduce((s, r) => s + Number(r.overall), 0) / rows.length;
    return { avg: Math.round(avg * 10) / 10, count: rows.length };
  }, [rows]);

  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!rows) return <div className="p-6 text-sm text-muted-foreground">Loading reviews…</div>;

  return (
    <div className="space-y-5">
      <div className="bg-secondary border border-border p-5 flex items-center gap-6">
        <div>
          <div className="text-4xl font-black text-brand leading-none">{summary?.avg.toFixed(1) ?? "—"}</div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">Average</div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <StarDisplay value={summary?.avg ?? 0} />
          <div className="text-xs text-muted-foreground mt-1">
            {summary ? `${summary.count} review${summary.count === 1 ? "" : "s"}` : "No reviews yet"}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="bg-card border border-border p-8 text-sm text-muted-foreground text-center">
          No reviews yet. Complete trips to start receiving feedback from patients and facilities.
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="bg-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <StarDisplay value={Number(r.overall)} />
                <span className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
              </div>
              {r.comment ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">{r.comment}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No comment left.</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

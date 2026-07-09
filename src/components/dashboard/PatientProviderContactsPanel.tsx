import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type ProviderContact = {
  id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  trips: number;
  lastTripAt: string | null;
};

export function PatientProviderContactsPanel() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProviderContact[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData.user?.id;
        if (!uid) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }
        const { data: reqs, error: reqErr } = await supabase
          .from("ride_requests")
          .select("assigned_provider_id, created_at")
          .eq("requester_user_id", uid)
          .not("assigned_provider_id", "is", null)
          .order("created_at", { ascending: false });
        if (reqErr) throw reqErr;

        const counts = new Map<string, { trips: number; lastTripAt: string | null }>();
        for (const r of reqs ?? []) {
          const pid = (r as any).assigned_provider_id as string | null;
          if (!pid) continue;
          const prev = counts.get(pid) ?? { trips: 0, lastTripAt: null };
          const nextLast = prev.lastTripAt && prev.lastTripAt > (r as any).created_at
            ? prev.lastTripAt
            : (r as any).created_at;
          counts.set(pid, { trips: prev.trips + 1, lastTripAt: nextLast });
        }

        const ids = Array.from(counts.keys());
        if (ids.length === 0) {
          if (!cancelled) { setRows([]); setLoading(false); }
          return;
        }

        const { data: provs, error: provErr } = await supabase
          .from("provider_applications")
          .select("id, company_name, email, phone, city")
          .in("id", ids);
        if (provErr) throw provErr;

        const merged: ProviderContact[] = (provs ?? []).map((p: any) => ({
          id: p.id,
          company_name: p.company_name,
          email: p.email,
          phone: p.phone,
          city: p.city,
          trips: counts.get(p.id)?.trips ?? 0,
          lastTripAt: counts.get(p.id)?.lastTripAt ?? null,
        })).sort((a, b) => (b.lastTripAt ?? "").localeCompare(a.lastTripAt ?? ""));

        if (!cancelled) { setRows(merged); setLoading(false); }
      } catch (e: any) {
        if (!cancelled) { setError(e?.message ?? "Failed to load contacts"); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-extrabold tracking-tight">Contacts</h2>
        <p className="text-sm text-muted-foreground">
          Transportation providers you've booked with before. Reach out to a preferred provider directly next time.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {!loading && !error && rows.length === 0 && (
        <div className="border border-border rounded-sm p-6 bg-card text-sm text-muted-foreground">
          You haven't ridden with a provider yet. Once a provider accepts one of your trips, they'll show up here.
        </div>
      )}

      <ul className="space-y-2">
        {rows.map((p) => (
          <li key={p.id} className="flex items-center justify-between border border-border rounded-sm p-3 bg-card">
            <div className="text-sm min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold truncate">{p.company_name ?? "Provider"}</span>
                <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-accent/15 text-accent">
                  {p.trips} trip{p.trips === 1 ? "" : "s"}
                </span>
              </div>
              <div className="text-muted-foreground text-xs truncate">
                {[p.phone, p.email, p.city].filter(Boolean).join(" • ") || "No contact info on file"}
              </div>
            </div>
            <div className="flex gap-3 text-sm font-bold shrink-0 ml-3">
              {p.phone && <a href={`tel:${p.phone}`} className="text-primary hover:underline">Call</a>}
              {p.email && <a href={`mailto:${p.email}`} className="text-primary hover:underline">Email</a>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

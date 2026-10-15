import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { geocodeAddress } from "@/lib/maps.functions";
import { toast } from "sonner";

export function NetworkPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const geocode = useServerFn(geocodeAddress);
  const q = useQuery({
    queryKey: ["network-settings", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_profiles")
        .select("preferred_zip_codes, service_radius_miles, long_distance_ok, city")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [zips, setZips] = useState("");
  const [radius, setRadius] = useState(25);
  const [longDistance, setLongDistance] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.data) {
      setZips((q.data.preferred_zip_codes ?? []).join(", "));
      setRadius((q.data as any).service_radius_miles ?? 25);
      setLongDistance(!!(q.data as any).long_distance_ok);
    }
  }, [q.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const zipArr = zips.split(/[,\s]+/).map((z) => z.trim()).filter(Boolean);
      // Geocode the first ZIP as the service-area center so radius enforcement works.
      let center: { lat: number; lng: number } | null = null;
      if (zipArr[0]) {
        try {
          const g = await geocode({ data: { address: `${zipArr[0]}, FL` } });
          if (g.ok) center = { lat: g.lat, lng: g.lng };
        } catch { /* geocode failure is non-fatal */ }
      }
      const { error } = await supabase
        .from("member_profiles")
        .update({
          preferred_zip_codes: zipArr,
          service_radius_miles: radius,
          long_distance_ok: longDistance,
          ...(center ? { center_lat: center.lat, center_lng: center.lng } : {}),
        } as any)
        .eq("user_id", userId);
      if (error) throw error;
      if (!center && zipArr[0]) toast.warning("Saved, but couldn't geocode your ZIP — auto-routing may be limited until we map it.");
      toast.success("Network preferences saved");
      qc.invalidateQueries({ queryKey: ["network-settings"] });
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold tracking-tight">Provider Network</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Tell My Florida NEMT where you'll accept auto-routed trips. We match incoming requests to providers whose ZIPs and radius cover the pickup.
        </p>
      </div>

      <form onSubmit={save} className="bg-card border border-border rounded-sm p-6 space-y-5">
        <label className="block">
          <div className="text-sm font-bold mb-1">Home ZIP codes</div>
          <input
            value={zips}
            onChange={(e) => setZips(e.target.value)}
            placeholder="32202, 32204, 32207"
            className="w-full border border-border rounded-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div className="text-xs text-muted-foreground mt-1">Comma separated. We use these as the centers of your service area.</div>
        </label>

        <label className="block">
          <div className="flex items-center justify-between text-sm font-bold mb-1">
            <span>Service radius</span>
            <span className="text-accent">{radius} miles</span>
          </div>
          <input
            type="range" min={10} max={50} step={5}
            value={radius} onChange={(e) => setRadius(parseInt(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-muted-foreground mt-1">
            10 mi (city only) → 50 mi (regional). Requests outside this won't be auto-routed to you.
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox" checked={longDistance}
            onChange={(e) => setLongDistance(e.target.checked)}
            className="mt-1"
          />
          <span className="text-sm">
            <span className="font-bold block">Accept long-distance trips (50+ miles)</span>
            <span className="text-muted-foreground text-xs">
              Cross-county and out-of-region transfers. Only check if you can actually run these — turn-backs count against your rating.
            </span>
          </span>
        </label>

        <button disabled={busy} className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {busy ? "Saving…" : "Save preferences"}
        </button>
      </form>

      <div className="bg-muted/40 border border-border rounded-sm p-5 text-sm">
        <div className="font-extrabold mb-2">Florida average NEMT pricing (reference)</div>
        <ul className="space-y-1 text-muted-foreground">
          <li>• Ambulatory load fee: <span className="text-foreground font-bold">$25–$50</span></li>
          <li>• Per-mile (ambulatory): <span className="text-foreground font-bold">$2.50–$3.50</span></li>
          <li>• Wheelchair load fee: <span className="text-foreground font-bold">$50–$75</span></li>
          <li>• Per-mile (wheelchair): <span className="text-foreground font-bold">$3.50–$5.00</span></li>
          <li>• Stretcher load fee: <span className="text-foreground font-bold">$100–$150</span></li>
          <li>• Wait time (after 15 min grace): <span className="text-foreground font-bold">$0.50–$1.00 / min</span></li>
        </ul>
        <p className="text-xs text-muted-foreground mt-3">
          Florida Medicaid MCO rates (Sunshine Health, Simply, Humana) vary by region and contract — use the Pricing tab to set your own charge & pay rates.
        </p>
      </div>
    </div>
  );
}

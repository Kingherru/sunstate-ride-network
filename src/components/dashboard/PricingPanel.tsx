import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyPricing, saveMyPricing } from "@/lib/pricing.functions";
import { calculateTripCost, DEFAULT_RATES, type PricingRates } from "@/lib/pricing";

const NUMERIC_FIELDS: Array<{ key: keyof PricingRates; label: string; hint?: string }> = [
  { key: "base_pickup", label: "Base pickup fee" },
  { key: "per_mile", label: "Per mile" },
  { key: "no_show", label: "No-show fee" },
  { key: "cancellation", label: "Cancellation fee" },
  { key: "wheelchair_addon", label: "Wheelchair add-on" },
  { key: "stretcher_addon", label: "Stretcher add-on" },
  { key: "after_hours_addon", label: "After-hours surcharge" },
  { key: "holiday_surcharge", label: "Holiday surcharge" },
  { key: "additional_passenger", label: "Additional passenger" },
  { key: "minimum_fare", label: "Minimum fare" },
];


export function PricingPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["pricing"], queryFn: () => getMyPricing() });
  const [form, setForm] = useState<PricingRates>(DEFAULT_RATES);

  useEffect(() => {
    if (q.data) setForm({ ...DEFAULT_RATES, ...(q.data as any) });
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => saveMyPricing({ data: form }),
    onSuccess: () => { toast.success("Pricing saved"); qc.invalidateQueries({ queryKey: ["pricing"] }); },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const sample = useMemo(() => calculateTripCost(
    { status: "completed", miles: 8.5, wait_minutes: 10, transport_type: "wheelchair", additional_passengers: 1, pickup_date: "", pickup_time: "20:30" },
    form,
  ), [form]);

  const setNum = (k: keyof PricingRates) => (v: string) =>
    setForm({ ...form, [k]: Number(v) || 0 } as PricingRates);

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={(e) => { e.preventDefault(); m.mutate(); }} className="lg:col-span-2 bg-card border border-border rounded-sm p-6 space-y-4">
        <h2 className="text-xl font-extrabold tracking-tight">Your pricing</h2>
        <p className="text-sm text-muted-foreground">Trip costs are calculated automatically using these rates. All fees are in USD.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {NUMERIC_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-sm">
              <span className="font-bold">{f.label}</span>
              <div className="flex items-center border border-border rounded-sm bg-background overflow-hidden">
                <span className="px-3 text-muted-foreground">$</span>
                <input type="number" min="0" step="0.01" value={String(form[f.key] ?? 0)}
                       onChange={(e) => setNum(f.key)(e.target.value)}
                       className="flex-1 px-2 py-2 bg-transparent focus:outline-none" />
              </div>
            </label>
          ))}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Wait time rate</span>
            <div className="flex items-center border border-border rounded-sm bg-background overflow-hidden">
              <span className="px-3 text-muted-foreground">$</span>
              <input type="number" min="0" step="0.01" value={String(form.wait_per_min ?? 0)}
                     onChange={(e) => setForm({ ...form, wait_per_min: Number(e.target.value) || 0 })}
                     className="flex-1 px-2 py-2 bg-transparent focus:outline-none" />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Wait billed per</span>
            <select
              value={form.wait_unit ?? "hour"}
              onChange={(e) => setForm({ ...form, wait_unit: e.target.value as PricingRates["wait_unit"] })}
              className="border border-border rounded-sm px-3 py-2 bg-background"
            >
              <option value="hour">Hour</option>
              <option value="half_hour">Half hour (30 min)</option>
              <option value="minute">Minute</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">After-hours start</span>
            <input type="time" value={form.after_hours_start.slice(0, 5)}
                   onChange={(e) => setForm({ ...form, after_hours_start: e.target.value })}
                   className="border border-border rounded-sm px-3 py-2 bg-background" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">After-hours end</span>
            <input type="time" value={form.after_hours_end.slice(0, 5)}
                   onChange={(e) => setForm({ ...form, after_hours_end: e.target.value })}
                   className="border border-border rounded-sm px-3 py-2 bg-background" />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-bold">Holiday dates (one YYYY-MM-DD per line)</span>
          <textarea rows={3} value={(form.holidays ?? []).join("\n")}
                    onChange={(e) => setForm({ ...form, holidays: e.target.value.split(/\s+/).map((s) => s.trim()).filter(Boolean) })}
                    className="border border-border rounded-sm px-3 py-2 bg-background font-mono text-xs" />
        </label>
        <button disabled={m.isPending}
                className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {m.isPending ? "Saving…" : "Save pricing"}
        </button>
      </form>

      <aside className="bg-card border border-border rounded-sm p-6 space-y-3 h-fit sticky top-4">
        <h3 className="font-extrabold tracking-tight">Sample quote</h3>
        <p className="text-xs text-muted-foreground">Completed wheelchair trip, 8.5 miles, 10 min wait, 1 extra passenger, 8:30pm pickup.</p>
        <ul className="text-sm space-y-1">
          {sample.lines.map((l, i) => (
            <li key={i} className="flex justify-between"><span className="text-muted-foreground">{l.label}</span><span className="font-mono">${l.amount.toFixed(2)}</span></li>
          ))}
        </ul>
        <div className="border-t border-border pt-2 flex justify-between font-extrabold">
          <span>Total</span><span className="font-mono">${sample.total.toFixed(2)}</span>
        </div>
      </aside>
    </div>
  );
}

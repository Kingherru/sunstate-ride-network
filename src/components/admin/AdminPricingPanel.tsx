import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getPlatformPricingDefaults, savePlatformPricingDefaults,
  FL_MARKET_DEFAULTS, FL_MEDICAID_DEFAULTS, type MarketPricing,
} from "@/lib/admin-pricing.functions";

const GROUPS: Array<{ label: string; fields: Array<{ key: keyof MarketPricing; label: string }> }> = [
  {
    label: "Ambulatory (sedan)",
    fields: [
      { key: "ambulatory_base", label: "Base pickup" },
      { key: "ambulatory_per_mile", label: "Per mile" },
    ],
  },
  {
    label: "Wheelchair",
    fields: [
      { key: "wheelchair_base", label: "Base pickup" },
      { key: "wheelchair_per_mile", label: "Per mile" },
    ],
  },
  {
    label: "Stretcher",
    fields: [
      { key: "stretcher_base", label: "Base pickup" },
      { key: "stretcher_per_mile", label: "Per mile" },
    ],
  },
  {
    label: "Time & fees",
    fields: [
      { key: "wait_per_hour", label: "Wait / hour" },
      { key: "no_show", label: "No-show" },
      { key: "cancellation", label: "Cancellation" },
      { key: "after_hours_addon", label: "After-hours" },
      { key: "holiday_surcharge", label: "Holiday" },
      { key: "additional_passenger", label: "Extra passenger" },
      { key: "minimum_fare", label: "Minimum fare" },
    ],
  },
];

function PricingColumn({
  title, subtitle, values, onChange, onReset, accent,
}: {
  title: string; subtitle: string; values: MarketPricing;
  onChange: (v: MarketPricing) => void; onReset: () => void; accent: string;
}) {
  return (
    <div className="bg-card border border-border rounded-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className={`text-lg font-extrabold tracking-tight ${accent}`}>{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button type="button" onClick={onReset}
          className="text-xs font-bold uppercase tracking-wider border border-border rounded-sm px-3 py-1.5 hover:bg-secondary">
          Reset to FL avg
        </button>
      </div>
      {GROUPS.map((g) => (
        <div key={g.label} className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g.label}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.fields.map((f) => (
              <label key={String(f.key)} className="flex flex-col gap-1 text-xs">
                <span className="font-bold">{f.label}</span>
                <div className="flex items-center border border-border rounded-sm bg-background overflow-hidden">
                  <span className="px-2 text-muted-foreground">$</span>
                  <input type="number" min="0" step="0.01"
                    value={String(values[f.key] ?? 0)}
                    onChange={(e) => onChange({ ...values, [f.key]: Number(e.target.value) || 0 })}
                    className="flex-1 px-2 py-1.5 bg-transparent focus:outline-none text-sm" />
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AdminPricingPanel() {
  const qc = useQueryClient();
  const load = useServerFn(getPlatformPricingDefaults);
  const save = useServerFn(savePlatformPricingDefaults);

  const q = useQuery({ queryKey: ["admin-pricing-defaults"], queryFn: () => load() });
  const [market, setMarket] = useState<MarketPricing>(FL_MARKET_DEFAULTS);
  const [medicaid, setMedicaid] = useState<MarketPricing>(FL_MEDICAID_DEFAULTS);

  useEffect(() => {
    if (q.data) {
      setMarket(q.data.market);
      setMedicaid(q.data.medicaid);
    }
  }, [q.data]);

  const m = useMutation({
    mutationFn: () => save({ data: { market, medicaid } }),
    onSuccess: () => {
      toast.success("Pricing defaults saved");
      qc.invalidateQueries({ queryKey: ["admin-pricing-defaults"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-sm p-5">
        <h2 className="text-xl font-extrabold tracking-tight">Statewide pricing defaults</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Recommended Florida market averages and Medicaid managed-care rates. These seed new
          provider pricing books and power quote estimates on public service pages.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <PricingColumn
          title="Florida market average"
          subtitle="Typical private-pay retail rates across FL NEMT providers."
          values={market}
          onChange={setMarket}
          onReset={() => setMarket(FL_MARKET_DEFAULTS)}
          accent="text-foreground"
        />
        <PricingColumn
          title="Florida Medicaid"
          subtitle="Managed transportation rates (Access2Care / MTM / ModivCare typical)."
          values={medicaid}
          onChange={setMedicaid}
          onReset={() => setMedicaid(FL_MEDICAID_DEFAULTS)}
          accent="text-accent"
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          disabled={m.isPending || q.isLoading}
          onClick={() => m.mutate()}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 rounded-sm hover:bg-primary/90 disabled:opacity-50">
          {m.isPending ? "Saving…" : "Save pricing defaults"}
        </button>
      </div>
    </div>
  );
}

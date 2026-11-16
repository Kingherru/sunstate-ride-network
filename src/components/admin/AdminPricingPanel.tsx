import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getPlatformPricingDefaults, savePlatformPricingDefaults,
  FL_MARKET_DEFAULTS, FL_MEDICAID_DEFAULTS, type MarketPricing,
} from "@/lib/admin-pricing.functions";
import { useAdminLevel } from "@/lib/use-admin-level";
import { DsButton } from "@/components/ds/controls";
import { DollarSign, RotateCcw, Save } from "lucide-react";
import { ReadOnlyBadge } from "@/components/ds/ReadOnlyBadge";

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
  title, subtitle, values, onChange, onReset, onSave, saving, readOnly,
}: {
  title: string; subtitle: string; values: MarketPricing;
  onChange: (v: MarketPricing) => void; onReset: () => void; readOnly: boolean;
  onSave: () => void; saving: boolean;
}) {
  return (
    <section className="portal-business-section">
      <div className="portal-business-heading grid min-w-0 gap-3 xl:min-h-40">
        <div className="min-w-0"><h3 className="ds-subheading flex items-center gap-2 uppercase"><DollarSign className="size-4 shrink-0" aria-hidden />{title}</h3><p className="ds-support mt-1">{subtitle}</p></div>
        {!readOnly && <DsButton type="button" size="sm" variant="secondary" className="justify-self-end" onClick={onReset}><RotateCcw className="size-4 shrink-0" aria-hidden />Reset to FL avg</DsButton>}
      </div>
      <div className="portal-business-body space-y-4">
      {GROUPS.map(g => <section key={g.label} className="min-w-0 border-b border-ds-border pb-4 last:border-b-0 last:pb-0">
        <h4 className="ds-label mb-3 uppercase text-ds-primary">{g.label}</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          {g.fields.map(f => <label key={String(f.key)} className="min-w-0 space-y-1">
            <span className="ds-label block">{f.label}</span>
            <span className="portal-pricing-input"><span aria-hidden>$</span><input aria-label={`${title}: ${f.label} in dollars`} type="number" min="0" step="0.01" disabled={readOnly} value={String(values[f.key] ?? 0)} onChange={e => onChange({ ...values, [f.key]: Number(e.target.value) || 0 })} className="portal-money-input" /></span>
          </label>)}
        </div>
      </section>)}
      </div>
      {!readOnly && <div className="portal-business-actions justify-end"><DsButton type="button" disabled={saving} onClick={onSave}><Save className="size-4 shrink-0" aria-hidden />{saving ? "Saving…" : "Save reference rates"}</DsButton></div>}
    </section>
  );
}

export function AdminPricingPanel() {
  const qc = useQueryClient();
  const level = useAdminLevel("pricing");
  const readOnly = level !== "manage";
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
    mutationFn: (section: 'market' | 'medicaid') => save({ data: { market: section === 'market' ? market : q.data?.market ?? FL_MARKET_DEFAULTS, medicaid: section === 'medicaid' ? medicaid : q.data?.medicaid ?? FL_MEDICAID_DEFAULTS } }),
    onSuccess: () => {
      toast.success("Pricing defaults saved");
      qc.invalidateQueries({ queryKey: ["admin-pricing-defaults"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  return (
    <div className="portal-business-form space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-2"><h2 className="ds-subheading uppercase text-ds-primary">Statewide pricing defaults</h2>{readOnly && <ReadOnlyBadge />}</div>
        <p className="ds-support text-ds-text-2">
          Recommended Florida market averages and Medicaid managed-care rates. These seed new
          provider pricing books and power quote estimates on public service pages.
        </p>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <PricingColumn
          title="Provider / market reference rates"
          subtitle="Typical private-pay retail rates across FL NEMT providers."
          values={market}
          onChange={setMarket}
          onReset={() => setMarket(FL_MARKET_DEFAULTS)}
          readOnly={readOnly}
          onSave={() => m.mutate('market')}
          saving={m.isPending || !q.data}
        />
        <PricingColumn
          title="Medicaid reference information"
          subtitle="Managed transportation rates (Access2Care / MTM / ModivCare typical)."
          values={medicaid}
          onChange={setMedicaid}
          onReset={() => setMedicaid(FL_MEDICAID_DEFAULTS)}
          readOnly={readOnly}
          onSave={() => m.mutate('medicaid')}
          saving={m.isPending || !q.data}
        />
      </div>

      {q.isError && <p role="alert" className="ds-support text-ds-error">Reference rates could not load. Saving is unavailable until the current values load.</p>}
    </div>
  );
}

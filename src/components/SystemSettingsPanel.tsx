import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getReferralFeeSettings, setReferralFeePercent } from "@/lib/referral-fee.functions";

export function SystemSettingsPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("platform_fee_pct, updated_at")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [pctInput, setPctInput] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.platform_fee_pct != null) {
      setPctInput((Number(data.platform_fee_pct) * 100).toString());
    }
  }, [data?.platform_fee_pct]);

  async function save() {
    const parsed = Number(pctInput);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      toast.error("Enter a percentage between 0 and 100");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({ platform_fee_pct: parsed / 100 })
      .eq("id", true);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Could not save platform fee");
      return;
    }
    toast.success("Platform fee updated");
    await qc.invalidateQueries({ queryKey: ["platform-settings"] });
    await qc.invalidateQueries({ queryKey: ["platform-fee-pct"] });
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-6 max-w-2xl">
      <div>
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-widest mb-1">Admin</p>
        <h2 className="text-2xl font-extrabold tracking-tight">System settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Global platform configuration. Changes take effect immediately for all providers.
        </p>
      </div>

      <section className="border-t border-border pt-6">
        <h3 className="text-lg font-extrabold tracking-tight mb-1">Platform fee</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Percentage deducted from every processed patient payment before releasing funds to providers.
          Providers see this value in their Payouts panel.
        </p>

        <div className="flex items-end gap-3">
          <label className="flex-1 max-w-[200px]">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
              Fee percentage
            </div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step={0.01}
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                disabled={isLoading || saving}
                className="w-full bg-background border border-border rounded-sm px-3 py-2 pr-8 font-bold tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </label>
          <button
            onClick={save}
            disabled={isLoading || saving}
            className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        {data?.updated_at && (
          <p className="text-xs text-muted-foreground mt-3">
            Last updated {new Date(data.updated_at).toLocaleString()}
          </p>
        )}
      </section>

      <ReferralPayoutSection />
    </div>
  );
}

/**
 * Admin-only control for the platform-wide referral payout percentage.
 * Hard capped at 10% — providers can neither see nor change it.
 */
function ReferralPayoutSection() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["referral-fee-settings"],
    queryFn: () => getReferralFeeSettings(),
  });

  const [input, setInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const max = data?.maxPercent ?? 10;

  useEffect(() => {
    if (data?.percent != null) setInput(String(data.percent));
  }, [data?.percent]);

  async function save() {
    const parsed = Number(input);
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > max) {
      toast.error(`Enter a percentage between 0 and ${max}`);
      return;
    }
    setSaving(true);
    try {
      await setReferralFeePercent({ data: { percent: parsed } });
      toast.success("Referral payout percentage updated");
      await qc.invalidateQueries({ queryKey: ["referral-fee-settings"] });
      await qc.invalidateQueries({ queryKey: ["referral-payout-cents"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save referral payout percentage");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border-t border-border pt-6">
      <h3 className="text-lg font-extrabold tracking-tight mb-1">Referral payout percentage</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Percentage of the client trip charge paid to the referring provider after a referred trip is
        completed. Maximum {max}%. Providers cannot view or change this value — the payout is
        calculated automatically by the system.
      </p>

      <div className="flex items-end gap-3">
        <label className="flex-1 max-w-[200px]">
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
            Referral percentage
          </div>
          <div className="relative">
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={max}
              step={0.1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || saving}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 pr-8 font-bold tabular-nums"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
          </div>
        </label>
        <button
          onClick={save}
          disabled={isLoading || saving}
          className="bg-primary text-primary-foreground font-bold px-5 py-2.5 rounded-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Applies to trips created after the change. Existing trips keep the rate captured when they
        were created.
      </p>
    </section>
  );
}

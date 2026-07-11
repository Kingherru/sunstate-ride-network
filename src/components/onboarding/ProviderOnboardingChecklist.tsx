import { Link } from "@tanstack/react-router";
import { CheckCircle2, Circle, ArrowRight, Sparkles } from "lucide-react";
import type { OnboardingResult, OnboardingStep } from "@/lib/provider-onboarding";

/**
 * Onboarding checklist shown on the provider dashboard while the account is
 * still in Soft Access mode. Modeled on the "JAX Contractor Hub" progress card
 * but rebuilt in the MyFloridaNemt navy + orange design language.
 */
export function ProviderOnboardingChecklist({
  onboarding,
  onGoToStep,
}: {
  onboarding: OnboardingResult;
  onGoToStep: (tabId: string) => void;
}) {
  const { steps, percent, doneCount, total, remaining, complete } = onboarding;

  return (
    <div className="space-y-6">
      {/* Top: progress + soft-access badge */}
      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="bg-card border border-border p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-accent">
                Provider onboarding
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-4xl font-extrabold tabular-nums text-brand">
                  {percent}%
                </span>
                <span className="text-sm text-muted-foreground">complete</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground max-w-md">
                {complete
                  ? "You're all set — the full Provider Portal is unlocked."
                  : `Finish ${remaining} more ${remaining === 1 ? "step" : "steps"} to unlock the full Provider Portal.`}
              </p>
            </div>
            <div className="bg-primary/10 px-4 py-3 text-center min-w-[92px]">
              <div className="text-2xl font-extrabold text-primary tabular-nums">
                {doneCount}/{total}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-primary/80">
                done
              </div>
            </div>
          </div>

          <div className="mt-5 h-2 w-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="bg-[oklch(0.18_0.05_257)] text-white p-6 border-l-4 border-accent">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-accent" />
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-accent">
              Soft access
            </p>
          </div>
          <h3 className="font-display text-lg font-bold leading-tight">
            You can start using the portal right now.
          </h3>
          <p className="mt-2 text-sm text-white/70">
            While your business profile is in progress, you have access to:
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {[
              ["new", "New Trip"],
              ["reservations", "Reservations"],
              ["schedule", "Schedule"],
            ].map(([tab, label]) => (
              <li key={tab}>
                <button
                  onClick={() => onGoToStep(tab)}
                  className="flex items-center gap-2 text-white hover:text-accent font-semibold"
                >
                  <ArrowRight className="h-3.5 w-3.5" /> {label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Checklist */}
      <div className="bg-card border border-border">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-display text-lg font-bold tracking-tight text-brand">
            Business profile checklist
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Complete these steps in any order. Full access unlocks automatically once every step is done.
          </p>
        </div>
        <ol className="divide-y divide-border">
          {steps.map((step, i) => (
            <ChecklistRow
              key={step.id}
              index={i + 1}
              step={step}
              onGo={() => onGoToStep(step.targetTab)}
            />
          ))}
        </ol>
      </div>

      {!complete && (
        <p className="text-xs text-muted-foreground">
          Need help?{" "}
          <Link to="/contact" className="underline font-semibold">
            Contact the My Florida NEMT team
          </Link>{" "}
          — we usually reply within one business hour.
        </p>
      )}
    </div>
  );
}

function ChecklistRow({
  index,
  step,
  onGo,
}: {
  index: number;
  step: OnboardingStep;
  onGo: () => void;
}) {
  return (
    <li className="flex items-start gap-4 px-6 py-4">
      <div className="pt-0.5">
        {step.done ? (
          <CheckCircle2 className="h-5 w-5 text-accent" />
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground/60" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
            Step {index}
          </span>
          {step.done && (
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-accent">
              Complete
            </span>
          )}
        </div>
        <div className="font-bold text-sm mt-0.5">{step.label}</div>
        <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
      </div>
      <button
        type="button"
        onClick={onGo}
        className={`text-xs font-bold uppercase tracking-wider px-3 py-2 border ${
          step.done
            ? "border-border text-muted-foreground hover:text-foreground"
            : "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
      >
        {step.done ? "Review" : "Complete →"}
      </button>
    </li>
  );
}

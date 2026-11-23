import * as React from "react";
import { cn } from "@/lib/utils";
import { timeParts, canonicalTime, type TimeParts } from "@/lib/trip-form-rules";

/** When true, every TimeSelect inside renders the compact Hour / Min / Min / AM-PM control. */
export const CompactTimeContext = React.createContext(false);

/** Compact 12-hour control. Emits canonical HH:MM only once an hour is chosen; minutes default to :00. */
export function CompactTimeControl({ value, onChange, id, invalid, disabled, label = "Time" }: { value: string; onChange: (v: string) => void; id?: string; invalid?: boolean; disabled?: boolean; label?: string }) {
  const parts = timeParts(value);
  const set = (patch: Partial<TimeParts>) => {
    const base: TimeParts = parts ?? { hour: 0, tens: 0, ones: 0, period: "AM" };
    const next = { ...base, ...patch };
    if (!next.hour) return;
    onChange(canonicalTime(next));
  };
  const cls = cn("portal-select compact-time-select", invalid && "border-destructive");
  return (
    <div role="group" aria-label={label} className="compact-time-control" data-compact-time>
      <select id={id} aria-label={`${label} hour`} disabled={disabled} aria-invalid={invalid || undefined} className={cls} value={parts?.hour ?? ""} onChange={e => e.target.value ? set({ hour: Number(e.target.value) }) : onChange("")}>
        <option value="">Hr</option>{Array.from({ length: 12 }, (_, i) => i + 1).map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span aria-hidden className="compact-time-colon">:</span>
      <select aria-label={`${label} minute tens`} disabled={disabled || !parts} className={cls} value={parts?.tens ?? 0} onChange={e => set({ tens: Number(e.target.value) })}>
        {[0, 1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select aria-label={`${label} minute ones`} disabled={disabled || !parts} className={cls} value={parts?.ones ?? 0} onChange={e => set({ ones: Number(e.target.value) })}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <option key={n} value={n}>{n}</option>)}
      </select>
      <select aria-label={`${label} AM or PM`} disabled={disabled || !parts} className={cls} value={parts?.period ?? "AM"} onChange={e => set({ period: e.target.value as "AM" | "PM" })}>
        <option value="AM">AM</option><option value="PM">PM</option>
      </select>
    </div>
  );
}
import {
  MIN_LEAD_MINUTES,
  minPickupTimeForDate,
  validatePickupDateTime,
} from "@/lib/booking-constraints";

/** 5-minute increment step, in minutes. */
export const TIME_STEP_MINUTES = 5;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "14:35" -> "2:35 PM" */
export function to12h(hhmm: string): string {
  const [hStr, mStr] = String(hhmm ?? "").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad(m)} ${period}`;
}

/** Snap any HH:MM(:SS) value down to the nearest 5-minute slot. */
export function snapToStep(hhmm: string): string {
  const [hStr, mStr] = String(hhmm ?? "").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const snapped = Math.round(m / TIME_STEP_MINUTES) * TIME_STEP_MINUTES;
  if (snapped === 60) return `${pad((h + 1) % 24)}:00`;
  return `${pad(h)}:${pad(snapped)}`;
}

/** All 5-minute slots in a day as { value: "HH:MM", label: "H:MM AM" }. */
export const TIME_OPTIONS: Array<{ value: string; label: string }> = (() => {
  const out: Array<{ value: string; label: string }> = [];
  for (let mins = 0; mins < 24 * 60; mins += TIME_STEP_MINUTES) {
    const value = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    out.push({ value, label: to12h(value) });
  }
  return out;
})();

/**
 * TimeSelect — 5-minute increment dropdown (9:00 AM, 9:05 AM, 9:10 AM …).
 *
 * Used everywhere a time is picked so the same increments apply on every
 * trip / reservation form. `min` (HH:MM) hides earlier slots.
 */
export function TimeSelect({
  value,
  onChange,
  required,
  className,
  id,
  name,
  min,
  disabled,
  placeholder = "Select a time",
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
  invalid?: boolean;
}) {
  const compact = React.useContext(CompactTimeContext);
  const current = snapToStep(String(value ?? "").slice(0, 5));
  const options = React.useMemo(() => {
    const base = min && min !== "23:59" ? TIME_OPTIONS.filter((o) => o.value >= min) : TIME_OPTIONS;
    // Never drop the currently-selected value from the list.
    if (current && !base.some((o) => o.value === current)) {
      return [{ value: current, label: to12h(current) }, ...base];
    }
    return base;
  }, [min, current]);

  if (compact) return <CompactTimeControl id={id} value={String(value ?? "").slice(0, 5)} onChange={onChange} invalid={invalid} disabled={disabled} label={placeholder === "Select a time" ? "Time" : placeholder} />;
  return (
    <select
      id={id}
      name={name}
      required={required}
      disabled={disabled}
      aria-invalid={invalid ? true : undefined}
      className={cn("portal-select w-full", invalid && "border-destructive", className)}
      value={current}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

/**
 * TimePickerField — labelled 5-minute time dropdown with booking-constraint
 * awareness.
 *
 * When `pickupDate` is provided, the field:
 *  - Hides slots earlier than the first valid one for that day (MIN_LEAD_MINUTES).
 *  - Shows an inline error if the chosen time violates the lead-time rule.
 *  - Shows helper text explaining the constraint when the date is today.
 */
export function TimePickerField({
  label,
  value,
  onChange,
  required,
  className,
  id,
  pickupDate,
  enforceLeadTime = false,
  helperText,
}: {
  label?: string;
  value: string; // HH:MM
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  id?: string;
  pickupDate?: string; // YYYY-MM-DD; when set, lead-time min is derived from this date
  enforceLeadTime?: boolean;
  helperText?: string;
}) {
  const rawMin = enforceLeadTime && pickupDate ? minPickupTimeForDate(pickupDate) : "";
  const minTime = rawMin && rawMin !== "23:59" ? snapToStep(rawMin) : rawMin;
  const error = enforceLeadTime && pickupDate && value
    ? validatePickupDateTime(pickupDate, value)
    : null;

  const hint = React.useMemo(() => {
    if (helperText) return helperText;
    if (enforceLeadTime && pickupDate && minTime && minTime !== "23:59") {
      const hrs = Math.round(MIN_LEAD_MINUTES / 60);
      return `Earliest today: ${to12h(minTime)} (${hrs}h minimum notice)`;
    }
    return null;
  }, [helperText, enforceLeadTime, pickupDate, minTime]);

  return (
    <label className={cn("block", className)}>
      {label && <span className="portal-label">{label}{required && " *"}</span>}
      <TimeSelect
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        min={minTime && minTime !== "23:59" ? minTime : undefined}
        invalid={!!error}
      />
      {error ? (
        <p className="mt-1 text-xs text-ds-error">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-ds-text-2">{hint}</p>
      ) : null}
    </label>
  );
}

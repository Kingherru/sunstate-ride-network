import * as React from "react";
import { cn } from "@/lib/utils";
import {
  MIN_LEAD_MINUTES,
  minPickupTimeForDate,
  validatePickupDateTime,
} from "@/lib/booking-constraints";

/**
 * TimePickerField — native <input type="time"> with booking-constraint awareness.
 *
 * When `pickupDate` is provided, the input:
 *  - Sets `min` to the earliest valid HH:MM for that day (respecting MIN_LEAD_MINUTES).
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
  const minTime = enforceLeadTime && pickupDate ? minPickupTimeForDate(pickupDate) : "";
  const error = enforceLeadTime && pickupDate && value
    ? validatePickupDateTime(pickupDate, value)
    : null;

  const hint = React.useMemo(() => {
    if (helperText) return helperText;
    if (enforceLeadTime && pickupDate && minTime && minTime !== "23:59") {
      const hrs = Math.round(MIN_LEAD_MINUTES / 60);
      return `Earliest today: ${minTime} (${hrs}h minimum notice)`;
    }
    return null;
  }, [helperText, enforceLeadTime, pickupDate, minTime]);

  return (
    <label className={cn("block", className)}>
      {label && <span className="portal-label">{label}{required && " *"}</span>}
      <input
        id={id}
        type="time"
        required={required}
        className={cn("portal-input w-full", error && "border-destructive")}
        value={value}
        min={minTime && minTime !== "23:59" ? minTime : undefined}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </label>
  );
}

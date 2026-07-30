import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { maxPickupDate, minPickupDate } from "@/lib/booking-constraints";

/**
 * DatePickerField
 * Fully interactive calendar picker that reads/writes ISO YYYY-MM-DD strings.
 * - Opens on the current month when no value is set.
 * - Defaults to the current year.
 * - Works inside dialogs (pointer-events-auto).
 * - Keyboard/screen-reader accessible via Radix Popover + shadcn Calendar.
 *
 * Booking constraints:
 * - `booking` prop applies platform-wide pickup date limits (min lead time, max advance days).
 * - Explicit `min` / `max` props still override the booking defaults.
 */
export function DatePickerField({
  label,
  value,
  onChange,
  required,
  className,
  placeholder = "Pick a date",
  min,
  max,
  id,
  booking = false,
  helperText,
}: {
  label?: string;
  value: string; // YYYY-MM-DD or ""
  onChange: (v: string) => void;
  required?: boolean;
  className?: string;
  placeholder?: string;
  min?: string; // YYYY-MM-DD
  max?: string;
  id?: string;
  booking?: boolean;
  helperText?: string;
}) {
  const parsed = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);
  const effMin = min ?? (booking ? minPickupDate() : undefined);
  const effMax = max ?? (booking ? maxPickupDate() : undefined);
  const minDate = effMin ? parse(effMin, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = effMax ? parse(effMax, "yyyy-MM-dd", new Date()) : undefined;

  return (
    <label className={cn("block", className)}>
      {label && <span className="portal-label">{label}{required && " *"}</span>}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-label={label ?? placeholder}
            className={cn(
              "portal-input w-full justify-start text-left font-normal h-auto",
              !parsed && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" aria-hidden />
            {parsed ? format(parsed, "EEE, MMM d, yyyy") : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 z-50" align="start">
          <Calendar
            mode="single"
            selected={parsed}
            defaultMonth={parsed ?? new Date()}
            onSelect={(d) => {
              if (!d) { onChange(""); return; }
              onChange(format(d, "yyyy-MM-dd"));
            }}
            disabled={(d) => {
              // Compare on calendar-day precision (ignore time).
              if (minDate) {
                const minDay = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());
                const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                if (day < minDay) return true;
              }
              if (maxDate) {
                const maxDay = new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate());
                const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                if (day > maxDay) return true;
              }
              return false;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {helperText && <p className="mt-1 text-xs text-muted-foreground">{helperText}</p>}
      {required && (
        // Mirror the value for AT/autofill only. Intentionally NOT `required`:
        // a hidden (sr-only) required control is unfocusable, so the browser
        // would silently block form submission with no visible message.
        <input
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={value}
          onChange={() => {}}
        />
      )}

    </label>
  );
}

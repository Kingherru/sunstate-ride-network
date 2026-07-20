import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * DatePickerField
 * Fully interactive calendar picker that reads/writes ISO YYYY-MM-DD strings.
 * - Opens on the current month when no value is set.
 * - Defaults to the current year.
 * - Works inside dialogs (pointer-events-auto).
 * - Keyboard/screen-reader accessible via Radix Popover + shadcn Calendar.
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
}) {
  const parsed = React.useMemo(() => {
    if (!value) return undefined;
    const d = parse(value, "yyyy-MM-dd", new Date());
    return isValid(d) ? d : undefined;
  }, [value]);
  const minDate = min ? parse(min, "yyyy-MM-dd", new Date()) : undefined;
  const maxDate = max ? parse(max, "yyyy-MM-dd", new Date()) : undefined;

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
              if (minDate && d < minDate) return true;
              if (maxDate && d > maxDate) return true;
              return false;
            }}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {required && (
        // Hidden native input keeps form-level `required` semantics for browsers/AT.
        <input
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={value}
          onChange={() => {}}
          required
        />
      )}
    </label>
  );
}

import { cn } from "@/lib/utils";

/** Square segmented tabs (no pills) used inside portal pages. */
export function SegTabs<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1 border-b border-ds-border">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={cn("ds-button-text -mb-px whitespace-nowrap border-b-2 px-3 py-2.5 uppercase ds-transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus",
            value === o.value ? "border-ds-action text-ds-primary" : "border-transparent text-ds-text-2 hover:text-ds-primary")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

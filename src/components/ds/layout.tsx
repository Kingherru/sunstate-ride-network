import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandName } from "@/components/brand/BrandName";

export function DsCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-ds bg-ds-surface text-ds-on-surface p-5 sm:p-6 shadow-ds", className)}>{children}</div>;
}

export type SoftTone = "sky" | "green" | "peach" | "sand" | "gray";
const softTone: Record<SoftTone, string> = {
  sky: "bg-ds-sky",
  green: "bg-ds-green",
  peach: "bg-ds-peach",
  sand: "bg-ds-sand",
  gray: "bg-ds-subtle",
};

/** Soft-colored box. No contrasting border, ever. */
export function DsSoftBox({ tone = "sky", className, children }: { tone?: SoftTone; className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-ds text-ds-on-soft p-5 sm:p-6", softTone[tone], className)}>{children}</div>;
}

export function DsTabs({ tabs }: { tabs: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div role="tablist" className="flex gap-1 border-b border-ds-border overflow-x-auto">
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={on}
              aria-controls={`panel-${t.id}`}
              onClick={() => setActive(t.id)}
              className={cn(
                "ds-button-text ds-transition -mb-px whitespace-nowrap border-b-2 px-4 py-2.5 rounded-t-ds-sm",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus",
                on ? "border-ds-accent text-ds-primary" : "border-transparent text-ds-text-2 hover:text-ds-primary hover:bg-ds-hover",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {tabs.map((t) =>
        t.id === active ? (
          <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-labelledby={`tab-${t.id}`} className="ds-fade-in pt-5">
            {t.content}
          </div>
        ) : null,
      )}
    </div>
  );
}

/** Public site header — solid blue. Uppercase nav; actions are icon + text, no background. */
export function DsPublicHeader({ links = ["Services", "Service Areas", "For Providers", "Training"] }: { links?: string[] }) {
  return (
    <header className="bg-ds-primary text-ds-on-primary">
      <div className="mx-auto max-w-6xl flex items-center justify-between gap-4 px-5 py-4">
        <BrandName on="blue" className="text-lg sm:text-xl" />
        <nav className="hidden md:flex items-center gap-6 ds-button-text text-[0.9375rem] uppercase tracking-[0.08em]">
          {links.map((l) => (
            <span key={l} className="ds-transition cursor-pointer hover:opacity-80">{l}</span>
          ))}
        </nav>
        <span className="ds-button-text inline-flex items-center gap-2 uppercase tracking-[0.04em] text-ds-accent"><CalendarPlus className="size-5" aria-hidden />Book a Trip</span>
      </div>
    </header>
  );
}

/** Portal menu — solid blue side navigation (stacks on mobile). */
export function DsPortalMenu({ items, active }: { items: string[]; active: string }) {
  return (
    <nav className="bg-ds-primary text-ds-on-primary md:w-56 md:min-h-full p-3 flex md:flex-col gap-1 overflow-x-auto">
      <div className="hidden md:block px-3 py-3 mb-2">
        <BrandName on="blue" casing="title" className="text-base" />
      </div>
      {items.map((i) => (
        <span
          key={i}
          aria-current={i === active ? "page" : undefined}
          className={cn(
            "ds-body ds-transition whitespace-nowrap rounded-ds-sm px-3 py-2 cursor-pointer",
            i === active ? "bg-ds-surface text-ds-primary font-semibold" : "hover:bg-ds-primary-hover",
          )}
        >
          {i}
        </span>
      ))}
    </nav>
  );
}

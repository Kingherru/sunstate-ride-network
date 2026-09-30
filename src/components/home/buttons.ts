import { cn } from "@/lib/utils";

/** Shared public button styles: 4px radius, no permanent borders, 3px focus ring. */
export const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus focus-visible:ring-offset-2";
const base = "ds-button-text ds-transition inline-flex min-h-13 items-center justify-center gap-2.5 rounded-ds px-6 text-[1.0625rem] [&_svg]:size-5 [&_svg]:shrink-0";

/** Dark action orange, white text. */
export const btnAction = cn(base, "bg-ds-action text-ds-on-action hover:bg-ds-action-hover active:bg-ds-action-pressed", focusRing);
/** Blue, white text. */
export const btnBlue = cn(base, "bg-ds-primary text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-active", focusRing);
/** White on blue backgrounds. */
export const btnOnBlue = cn(base, "bg-ds-surface text-ds-primary hover:bg-ds-sky", focusRing, "focus-visible:ring-offset-ds-primary");
/** Quiet gray on light backgrounds. */
export const btnLight = cn(base, "bg-ds-subtle text-ds-primary hover:bg-ds-hover", focusRing);

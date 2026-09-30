import { cn } from "@/lib/utils";

/** Shared public button styles: square, 2px same-family borders, 3px focus ring. */
export const focusRing = "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ds-focus focus-visible:ring-offset-2";
const base = "ds-button-text ds-transition inline-flex min-h-13 items-center justify-center gap-2.5 border-2 px-6 text-[1.0625rem] [&_svg]:size-5 [&_svg]:shrink-0";

/** Dark action orange, white text. */
export const btnAction = cn(base, "border-ds-action-border bg-ds-action text-ds-on-action hover:bg-ds-action-hover active:bg-ds-action-pressed", focusRing);
/** Blue, white text. */
export const btnBlue = cn(base, "border-ds-primary-border bg-ds-primary text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-active", focusRing);
/** White on blue backgrounds. */
export const btnOnBlue = cn(base, "border-ds-border bg-ds-surface text-ds-primary hover:bg-ds-sky", focusRing, "focus-visible:ring-offset-ds-primary");
/** White/gray on light backgrounds. */
export const btnLight = cn(base, "border-ds-border-strong bg-ds-surface text-ds-primary hover:bg-ds-hover", focusRing);

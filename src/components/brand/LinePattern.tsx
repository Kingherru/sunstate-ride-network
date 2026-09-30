import { cn } from "@/lib/utils";

/**
 * Decorative line art for selected public marketing sections only.
 * Nine short, thin, gently bent lines flowing the same direction.
 * The art is oversized; each preset shows a fixed crop (no randomness).
 * Parent section must be `relative overflow-hidden`; content goes above with `relative`.
 */

// Deterministic geometry: 9 lines rising left→right with a soft S-bend.
const LINES = Array.from({ length: 9 }, (_, i) => {
  const x = 140 + i * 105 + (i % 3) * 18;
  const y = 640 - i * 36 - (i % 2) * 22;
  const len = 260 + (i % 4) * 40;
  const bend = 34 + (i % 3) * 10;
  const x2 = x + len;
  const y2 = y - len * 0.55;
  return `M ${x} ${y} C ${x + len * 0.35} ${y - bend}, ${x + len * 0.6} ${y2 + bend * 1.4}, ${x2} ${y2}`;
});

export const LINE_PATTERN_PRESETS = {
  "top-right": "right-[-35%] top-[-40%]",
  "top-left": "left-[-45%] top-[-45%]",
  "bottom-right": "right-[-40%] bottom-[-55%]",
  "bottom-left": "left-[-50%] bottom-[-50%]",
  "right-edge": "right-[-60%] top-[-10%]",
  "left-edge": "left-[-65%] top-[-5%]",
  "top-band": "left-[-20%] top-[-70%]",
  "bottom-band": "left-[-10%] bottom-[-75%]",
  "far-corner": "right-[-70%] bottom-[-70%]",
} as const;

export type LinePatternPreset = keyof typeof LINE_PATTERN_PRESETS;

export function LinePattern({
  preset = "top-right",
  tone = "dark",
  opacity = 0.05,
  className,
}: {
  preset?: LinePatternPreset;
  /** dark = blue lines on light sections; light = white lines on blue sections */
  tone?: "dark" | "light";
  opacity?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 1400 800"
      preserveAspectRatio="xMidYMid slice"
      className={cn(
        "pointer-events-none absolute z-0 h-[180%] w-[180%] select-none",
        tone === "dark" ? "text-ds-primary" : "text-ds-on-primary",
        LINE_PATTERN_PRESETS[preset],
        className,
      )}
      style={{ opacity }}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
    >
      {LINES.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

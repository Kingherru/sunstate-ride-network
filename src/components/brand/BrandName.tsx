import { cn } from "@/lib/utils";

type Props = {
  /** Background it sits on — picks the accessible color for "MY FLORIDA". */
  on?: "light" | "blue";
  /** Kept for compatibility; the public brand always renders uppercase. */
  casing?: "upper" | "title";
  className?: string;
};

/** The one brand-name component. "NEMT" is always orange. */
export function BrandName({ on = "light", casing = "upper", className }: Props) {
  const first = "MY FLORIDA";
  return (
    <span className={cn("font-heading font-bold whitespace-nowrap", className)} aria-label="MY FLORIDA NEMT">
      <span className={on === "blue" ? "text-ds-on-primary" : "text-ds-primary"}>{first}</span>{" "}
      <span className="text-ds-accent">NEMT</span>
    </span>
  );
}

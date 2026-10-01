import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { children: React.ReactNode; className?: string; direction?: "up" | "left" | "right"; delay?: number; disabled?: boolean };

/** Homepage-only, one-time viewport reveal. Content stays visible without JavaScript. */
export function HomeReveal({ children, className, direction = "up", delay = 0, disabled = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (disabled || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setSeen(true);
      observer.disconnect();
    }, { threshold: 0.12, rootMargin: "0px 0px -6%" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [disabled]);
  return <div ref={ref} className={cn(!disabled && "home-reveal", !disabled && `home-reveal-${direction}`, (seen || disabled) && "is-visible", className)} style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}>{children}</div>;
}
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Universal portal status colors. Display-only: never changes underlying status values. */
export type StatusTone = "red" | "green" | "yellow" | "neutral";

const RED = /(under[ _-]?review|needs[ _-]?attention|not[ _-]?accepted|declin|reject|not[ _-]?approved|fail|overdue|disput|restrict|suspend|missing|expired|revoked|blocked|held for review|chargeback)/i;
const YELLOW = /(safety|precaution|verify|payment responsibility|needs[ _-]?confirmation|caution|warning)/i;
const GREEN = /(approved|accepted|complete|success|enabled|^active$|paid|verified|transferred|delivered|confirmed|resolved)/i;

export function statusTone(label: string | null | undefined): StatusTone {
  const s = String(label ?? "").trim();
  if (!s) return "neutral";
  if (RED.test(s)) return "red";
  if (YELLOW.test(s)) return "yellow";
  if (GREEN.test(s)) return "green";
  return "neutral";
}

export const toneClass: Record<StatusTone, string> = {
  red: "ds-status-red",
  green: "ds-status-green",
  yellow: "ds-status-yellow",
  neutral: "bg-ds-sky text-ds-primary",
};
const toneIcon = { red: XCircle, green: CheckCircle2, yellow: AlertTriangle, neutral: Info };

export function humanStatus(s: string) {
  return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Solid, labelled status pill; tone derives from the label unless given. */
export function StatusPill({ status, tone, className }: { status: string; tone?: StatusTone; className?: string }) {
  const t = tone ?? statusTone(status);
  const Icon = toneIcon[t];
  return <span className={cn("inline-flex items-center gap-1 rounded-ds-sm px-2 py-0.5 text-[0.8125rem] font-bold", toneClass[t], className)}>
    <Icon className="size-3.5 shrink-0" aria-hidden />{humanStatus(status)}
  </span>;
}

import { useEffect, useState } from "react";
import { CHANGELOG } from "@/components/ChangelogChip";

/** Last-seen change-log version (no personal data). Unread ordinary update →
 *  light-green dot; unread important update → red dot with one wiggle. */
const KEY = (admin: boolean) => `mfn-changelog-seen:${admin ? "admin" : "portal"}`;
const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

export function useChangelogIndicator(admin: boolean, viewing: boolean): "none" | "update" | "important" {
  const [state, setState] = useState<"none" | "update" | "important">("none");
  useEffect(() => {
    const entries = CHANGELOG.filter((e) => admin || !e.adminOnly);
    const latest = entries[0]?.version;
    if (!latest) return;
    if (viewing) { localStorage.setItem(KEY(admin), latest); setState("none"); return; }
    const seen = localStorage.getItem(KEY(admin));
    const unseen = entries.filter((e) => !seen || cmp(e.version, seen) > 0);
    setState(unseen.length === 0 ? "none" : unseen.some((e) => e.important) ? "important" : "update");
  }, [admin, viewing]);
  return state;
}

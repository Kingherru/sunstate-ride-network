import { CHANGELOG } from "@/components/ChangelogChip";

const fmt = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

/** Release notes from the existing change-log feature, restyled for the portal. */
export function ChangelogView() {
  return (
    <ol className="divide-y divide-ds-border">
      {CHANGELOG.map((e) => (
        <li key={e.version} className="py-5 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="ds-subheading uppercase text-ds-primary">Version {e.version}</h2>
            <span className="ds-support">{fmt(e.date)}</span>
          </div>
          <ul className="ds-body mt-2 list-disc space-y-1 pl-5">
            {e.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </li>
      ))}
    </ol>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listExpiringCredentials } from "@/lib/medicaid.functions";

export function ExpiringCredentialsPanel() {
  const fn = useServerFn(listExpiringCredentials);
  const q = useQuery({ queryKey: ["expiring-credentials"], queryFn: () => fn() });

  const rows = q.data ?? [];
  const expired = rows.filter((r) => (r.days_until_expiry ?? 0) < 0);
  const soon = rows.filter((r) => (r.days_until_expiry ?? 0) >= 0);

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div>
        <h3 className="text-lg font-extrabold tracking-tight">Provider credential alerts</h3>
        <p className="text-xs text-muted-foreground">
          Insurance, vehicle registration, driver's license, Medicaid certification and other required credentials
          expiring within 30 days. Expired credentials block trip assignment automatically.
        </p>
      </div>

      {q.isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!q.isLoading && rows.length === 0 && (
        <div className="text-sm text-muted-foreground">All provider credentials are current. 🎉</div>
      )}

      {expired.length > 0 && (
        <Section title={`Expired (${expired.length}) — assignments blocked`} rows={expired} tone="red" />
      )}
      {soon.length > 0 && (
        <Section title={`Expiring soon (${soon.length})`} rows={soon} tone="orange" />
      )}
    </div>
  );
}

function Section({ title, rows, tone }: { title: string; rows: any[]; tone: "red" | "orange" }) {
  const bg = tone === "red" ? "bg-red-50 text-red-700 border-red-300" : "bg-orange-50 text-orange-700 border-orange-300";
  return (
    <div className={`border rounded-sm ${bg} p-3 space-y-2`}>
      <div className="text-xs font-bold uppercase tracking-wide">{title}</div>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="text-left"><th className="py-1">Provider</th><th>Credential</th><th>Expires</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/40">
              <td className="py-1 font-bold text-foreground">
                {r.company_name ?? "—"} <span className="font-mono text-xs text-muted-foreground">{r.provider_display_id ?? ""}</span>
              </td>
              <td className="text-foreground">{r.label}</td>
              <td className="whitespace-nowrap">
                {r.expires_at ?? "—"} {r.days_until_expiry !== null && (
                  <span className="text-xs">({r.days_until_expiry < 0 ? `${Math.abs(r.days_until_expiry)}d overdue` : `in ${r.days_until_expiry}d`})</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

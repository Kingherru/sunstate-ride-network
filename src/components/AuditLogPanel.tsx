import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog } from "@/lib/staff.functions";

const ACTION_LABELS: Record<string, string> = {
  role_granted: "Role granted",
  role_revoked: "Role revoked",
  zone_assigned: "Zone assigned",
  zone_unassigned: "Zone unassigned",
  password_reset_sent: "Password reset sent",
  provider_application_approved: "Provider approved",
  provider_application_denied: "Provider denied",
  trip_assigned: "Trip assigned",
  trip_unassigned: "Trip unassigned",
  trip_canceled: "Trip canceled",
};

export function AuditLogPanel() {
  const fn = useServerFn(listAuditLog);
  const q = useQuery({ queryKey: ["audit-log"], queryFn: () => fn({ data: { limit: 100 } }) });
  const entries = q.data?.entries ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Audit log</h3>
          <p className="mt-1 text-sm text-slate-600">
            Every staff role change, password reset, zone assignment, and provider review is recorded here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => q.refetch()}
          className="text-xs font-medium text-slate-600 hover:text-slate-900"
        >Refresh</button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {q.isLoading ? (
          <p className="px-5 py-6 text-sm text-slate-600">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-600">No audit entries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-sm">
            {entries.map((e: any) => (
              <li key={e.id} className="px-5 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-slate-900">
                      {ACTION_LABELS[e.action] ?? e.action}
                    </div>
                    <div className="text-xs text-slate-600">
                      {e.actor_display_id ?? "—"} · {e.actor_email ?? ""}
                      {e.target_kind && e.target_id ? ` → ${e.target_kind}:${e.target_id.slice(0, 8)}` : ""}
                    </div>
                    {e.metadata && Object.keys(e.metadata).length > 0 && (
                      <div className="mt-0.5 text-xs text-slate-600 truncate max-w-[600px]">
                        {Object.entries(e.metadata).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join("  ·  ")}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

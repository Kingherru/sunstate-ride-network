import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNonPatientUsers } from "@/lib/admin-users.functions";

/**
 * Shows every registered account for a portal (provider or facility) sourced
 * directly from auth.users + member_profiles. This is the single source of
 * truth in the Admin Portal — every account that exists anywhere in the
 * platform appears here in real time.
 */
export function RegisteredMembersList({
  portal,
  title,
}: {
  portal: "provider" | "facility";
  title: string;
}) {
  const fetchUsers = useServerFn(listNonPatientUsers);
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin", "non-patient-users"],
    queryFn: () => fetchUsers(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const rows = useMemo(() => {
    const all = (usersQ.data ?? []).filter((u: any) => u.portal === portal);
    if (!q.trim()) return all;
    const t = q.toLowerCase();
    return all.filter(
      (u: any) =>
        (u.email ?? "").toLowerCase().includes(t) ||
        (u.company_name ?? "").toLowerCase().includes(t) ||
        (u.city ?? "").toLowerCase().includes(t),
    );
  }, [usersQ.data, portal, q]);

  return (
    <div className="bg-card border border-border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            All registered {portal} accounts — synced live from the platform. {rows.length} shown.
          </p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search email, company, city…"
          className="min-w-[260px] px-3 py-2 border border-border text-sm bg-background"
        />
      </div>

      {usersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : usersQ.error ? (
        <p className="text-sm text-red-600">Could not load: {(usersQ.error as any).message}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Company / Facility</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Region</th>
                <th className="py-2 pr-3">Membership</th>
                <th className="py-2 pr-3">Created</th>
                <th className="py-2 pr-3">Last sign-in</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{u.email ?? "—"}</td>
                  <td className="py-2 pr-3">{u.company_name ?? "—"}</td>
                  <td className="py-2 pr-3">{u.city ?? "—"}</td>
                  <td className="py-2 pr-3">{u.region ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {u.membership_tier ?? "—"}
                    {u.membership_status ? ` · ${u.membership_status}` : ""}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                    No {portal} accounts yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

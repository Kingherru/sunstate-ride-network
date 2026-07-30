import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listNonPatientUsers, setMemberMembership } from "@/lib/admin-users.functions";
import { supabase } from "@/integrations/supabase/client";



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
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const usersQ = useQuery({
    queryKey: ["admin", "non-patient-users"],
    queryFn: () => fetchUsers(),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // Real-time sync: refetch when member profiles, roles, or provider apps change
  useEffect(() => {
    const channel = supabase
      .channel(`admin-members-${portal}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "member_profiles" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "provider_applications" }, () => {
        qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [portal, qc]);


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
                <th className="py-2 pr-3">State</th>
                <th className="py-2 pr-3">ZIP</th>
                <th className="py-2 pr-3">Dispatch Zone</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Vehicles</th>
                <th className="py-2 pr-3">Drivers</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Membership</th>
                <th className="py-2 pr-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => (
                <tr key={u.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-mono text-xs">{u.email ?? "—"}</td>
                  <td className="py-2 pr-3">{u.company_name ?? "—"}</td>
                  <td className="py-2 pr-3">{u.city ?? "—"}</td>
                  <td className="py-2 pr-3">{u.state ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{u.postal_code ?? "—"}</td>
                  <td className="py-2 pr-3">
                    {u.dispatch_zone_name
                      ? `${u.dispatch_zone_name}${u.dispatch_zone_code ? ` (${u.dispatch_zone_code})` : ""}`
                      : u.region ?? "—"}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs">{u.phone ?? "—"}</td>
                  <td className="py-2 pr-3 text-center">{u.vehicles_count ?? 0}</td>
                  <td className="py-2 pr-3 text-center">{u.drivers_count ?? 0}</td>
                  <td className="py-2 pr-3 text-xs">
                    {u.application_status === "approved" ? (
                      <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 font-semibold">Approved</span>
                    ) : u.application_status ? (
                      <span className="inline-block px-2 py-0.5 bg-muted text-muted-foreground">{u.application_status}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    <MembershipControl user={u} />
                  </td>

                  <td className="py-2 pr-3 text-xs text-muted-foreground">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="py-6 text-center text-sm text-muted-foreground">
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

/**
 * Inline membership control: lets admins/ops grant or revoke a member's
 * membership tier. Writes go through the audited `setMemberMembership`
 * server action (regular members cannot change these fields themselves).
 */
function MembershipControl({ user }: { user: any }) {
  const qc = useQueryClient();
  const setMembership = useServerFn(setMemberMembership);
  const tier: string = user.membership_tier ?? "none";
  const status: string = user.membership_status ?? "inactive";

  const mutation = useMutation({
    mutationFn: (next: "none" | "free" | "paid") =>
      setMembership({ data: { user_id: user.id, tier: next } }),
    onSuccess: (_d, next) => {
      toast.success(
        next === "none"
          ? "Membership removed"
          : `Membership set to ${next === "paid" ? "Paid" : "Free"}`,
      );
      qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not update membership"),
  });

  return (
    <div className="flex items-center gap-2">
      <select
        value={tier}
        disabled={mutation.isPending}
        onChange={(e) => mutation.mutate(e.target.value as "none" | "free" | "paid")}
        className="text-xs font-semibold bg-background border border-border rounded-sm px-2 py-1 disabled:opacity-60"
        aria-label={`Membership for ${user.email ?? user.company_name ?? "member"}`}
      >
        <option value="none">None</option>
        <option value="free">Free</option>
        <option value="paid">Paid</option>
      </select>
      <span
        className={
          status === "active"
            ? "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-emerald-100 text-emerald-800"
            : "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm bg-muted text-muted-foreground"
        }
      >
        {status}
      </span>
    </div>
  );
}

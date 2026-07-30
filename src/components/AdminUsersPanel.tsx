import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { TestDispatchAccountCard } from "@/components/admin/TestDispatchAccountCard";

import {
  listNonPatientUsers,
  getUserRoleDetails,
  setUserPrimaryRole,
  MANAGEABLE_ROLES,
  ROLE_LABELS,
  type ManageableRole,
} from "@/lib/admin-users.functions";

type PendingChange = {
  user_id: string;
  email: string | null;
  current_role: ManageableRole;
  new_role: ManageableRole;
};

function RoleSelect({
  value,
  onChange,
  disabled,
}: {
  value: ManageableRole;
  onChange: (r: ManageableRole) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ManageableRole)}
      className="border border-border bg-background px-2 py-1 text-xs"
    >
      {MANAGEABLE_ROLES.map((r) => (
        <option key={r} value={r}>
          {ROLE_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

export function AdminUsersPanel() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listNonPatientUsers);
  const lookupFn = useServerFn(getUserRoleDetails);
  const setRoleFn = useServerFn(setUserPrimaryRole);

  const [filter, setFilter] = useState<"all" | "provider" | "facility">("all");
  const [q, setQ] = useState("");
  const [pending, setPending] = useState<PendingChange | null>(null);

  const usersQ = useQuery({
    queryKey: ["admin", "non-patient-users"],
    queryFn: () => fetchUsers(),
  });

  // Lookup any user (including patients/staff not in the list) by email
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    user_id: string;
    email: string | null;
    current_role: ManageableRole;
  } | null>(null);

  const lookupMut = useMutation({
    mutationFn: async (email: string) => lookupFn({ data: { email } }),
    onSuccess: (r) => setLookupResult({
      user_id: r.user_id,
      email: r.email,
      current_role: r.current_role as ManageableRole,
    }),
    onError: (e: any) => toast.error(e?.message ?? "Lookup failed"),
  });

  const saveMut = useMutation({
    mutationFn: async (v: { user_id: string; role: ManageableRole }) =>
      setRoleFn({ data: v }),
    onSuccess: (r) => {
      toast.success(
        `Role updated: ${ROLE_LABELS[r.previous_role as ManageableRole]} → ${ROLE_LABELS[r.new_role as ManageableRole]}. Changes take effect on the user's next page load.`,
      );
      setPending(null);
      qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
      qc.invalidateQueries({ queryKey: ["staff"] });
      if (lookupResult) {
        setLookupResult({ ...lookupResult, current_role: r.new_role as ManageableRole });
      }
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to change role"),
  });

  const rows = (usersQ.data ?? []).filter((u: any) => {
    if (filter !== "all" && u.portal !== filter) return false;
    if (q) {
      const t = q.toLowerCase();
      if (
        !(u.email ?? "").toLowerCase().includes(t) &&
        !(u.company_name ?? "").toLowerCase().includes(t) &&
        !(u.city ?? "").toLowerCase().includes(t)
      )
        return false;
    }
    return true;
  });

  const counts = (usersQ.data ?? []).reduce(
    (acc: any, u: any) => {
      acc[u.portal] = (acc[u.portal] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const requestChange = (u: {
    user_id: string;
    email: string | null;
    current_role: ManageableRole;
  }, newRole: ManageableRole) => {
    if (newRole === u.current_role) return;
    setPending({
      user_id: u.user_id,
      email: u.email,
      current_role: u.current_role,
      new_role: newRole,
    });
  };

  return (
    <>
    <TestDispatchAccountCard />
    <div className="bg-card border border-border p-5">

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">All users — providers &amp; facilities</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Patient accounts are hidden from this list to protect PHI. Use the lookup below to manage a patient or staff role by email.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {(["all", "provider", "facility"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 border ${filter === k ? "bg-primary text-white border-primary" : "bg-background border-border"}`}
            >
              {k === "all" ? `All (${(usersQ.data ?? []).length})` : `${k} (${counts[k] ?? 0})`}
            </button>
          ))}
        </div>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search email, company, or city"
        className="w-full mb-3 px-3 py-2 border border-border text-sm bg-background"
      />

      {usersQ.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading users…</p>
      ) : usersQ.error ? (
        <p className="text-sm text-red-600">Could not load users: {(usersQ.error as any).message}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
              <tr>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Portal</th>
                <th className="py-2 pr-3">Company / Facility</th>
                <th className="py-2 pr-3">City</th>
                <th className="py-2 pr-3">Membership</th>
                <th className="py-2 pr-3">Last sign-in</th>
                <th className="py-2 pr-3">Role</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u: any) => {
                const currentRole = (u.portal === "provider" || u.portal === "facility"
                  ? (u.portal as ManageableRole)
                  : "provider");
                return (
                  <tr key={u.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs">{u.email ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase ${
                          u.portal === "provider"
                            ? "bg-accent/15 text-accent"
                            : u.portal === "facility"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/20 text-muted-foreground"
                        }`}
                      >
                        {u.portal}
                      </span>
                    </td>
                    <td className="py-2 pr-3">{u.company_name ?? "—"}</td>
                    <td className="py-2 pr-3">{u.city ?? "—"}</td>
                    <td className="py-2 pr-3">
                      <MembershipSelect user={u} />
                    </td>

                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "never"}
                    </td>
                    <td className="py-2 pr-3">
                      <RoleSelect
                        value={currentRole}
                        onChange={(r) =>
                          requestChange(
                            { user_id: u.id, email: u.email, current_role: currentRole },
                            r,
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-sm text-muted-foreground">No matching users.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Lookup any user by email (patients, staff, etc.) */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-sm font-bold tracking-tight">Change any user's role</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Look up any user by email — including patients and staff — to view and change their role.
        </p>
        <div className="flex flex-wrap items-end gap-2 mt-3">
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 min-w-[240px] px-3 py-2 border border-border text-sm bg-background"
          />
          <button
            type="button"
            onClick={() => lookupEmail && lookupMut.mutate(lookupEmail.trim())}
            disabled={!lookupEmail || lookupMut.isPending}
            className="px-4 py-2 bg-primary text-white text-sm disabled:opacity-60"
          >
            {lookupMut.isPending ? "Looking up…" : "Look up"}
          </button>
        </div>

        {lookupResult && (
          <div className="mt-3 border border-border p-3 bg-background/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">User</div>
                <div className="font-mono text-sm">{lookupResult.email ?? lookupResult.user_id}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Current role</div>
                <div className="text-sm font-semibold">{ROLE_LABELS[lookupResult.current_role]}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">Change to</div>
                <RoleSelect
                  value={lookupResult.current_role}
                  onChange={(r) => requestChange(lookupResult, r)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Passwords are stored as one-way hashes and are <strong>not</strong> retrievable — not by admins, not by us.
        Use the "Send password reset" flow if a user is locked out.
      </p>

      {/* Confirmation dialog */}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !saveMut.isPending && setPending(null)}
        >
          <div
            className="bg-card border border-border max-w-md w-full p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="text-base font-extrabold tracking-tight">Confirm role change</h4>
            <p className="text-sm mt-2">
              Change role for <span className="font-mono">{pending.email ?? pending.user_id}</span>?
            </p>
            <div className="mt-3 text-sm bg-muted/20 border border-border p-3">
              <div><span className="text-muted-foreground">From:</span> <strong>{ROLE_LABELS[pending.current_role]}</strong></div>
              <div className="mt-1"><span className="text-muted-foreground">To:</span> <strong>{ROLE_LABELS[pending.new_role]}</strong></div>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Permissions and portal access update immediately. The user will see the new dashboard on their next page load or sign-in. This change is written to the audit log.
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={saveMut.isPending}
                className="px-3 py-2 border border-border text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveMut.mutate({ user_id: pending.user_id, role: pending.new_role })}
                disabled={saveMut.isPending}
                className="px-4 py-2 bg-primary text-white text-sm disabled:opacity-60"
              >
                {saveMut.isPending ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );

}

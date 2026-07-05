import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  listStaff, grantRole, revokeRole, findUserByEmail,
  setZoneAssignment, resetStaffPassword, listZones,
  type StaffRole,
} from "@/lib/staff.functions";

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Administrator",
  app_manager: "App Manager",
  zone_manager: "Zone Manager",
  dispatcher: "Dispatcher",
  staff: "Staff",
};

const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  admin: "Full system access, including Lovable + hard-coded functionality.",
  app_manager: "Operational admin. Cannot access Lovable or hard-coded code.",
  zone_manager: "Manages one or more Dispatch Zones and their trips/providers.",
  dispatcher: "Views, creates, reassigns, and cancels reservations.",
  staff: "General staff (legacy).",
};

const ASSIGNABLE_ROLES: StaffRole[] = ["admin", "app_manager", "zone_manager", "dispatcher", "staff"];

export function StaffPermissionsPanel({ callerIsAdmin }: { callerIsAdmin: boolean }) {
  const qc = useQueryClient();
  const listStaffFn = useServerFn(listStaff);
  const listZonesFn = useServerFn(listZones);
  const grantFn = useServerFn(grantRole);
  const revokeFn = useServerFn(revokeRole);
  const findFn = useServerFn(findUserByEmail);
  const setZoneFn = useServerFn(setZoneAssignment);
  const resetFn = useServerFn(resetStaffPassword);

  const staffQ = useQuery({ queryKey: ["staff", "list"], queryFn: () => listStaffFn() });
  const zonesQ = useQuery({ queryKey: ["staff", "zones"], queryFn: () => listZonesFn() });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("dispatcher");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["staff"] });

  const inviteMut = useMutation({
    mutationFn: async () => {
      const found = await findFn({ data: { email } });
      if (!found.user_id) throw new Error("No account found for that email. The user must sign up first.");
      await grantFn({ data: { user_id: found.user_id, role } });
      return found;
    },
    onSuccess: () => { toast.success("Role granted"); setEmail(""); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to grant role"),
  });

  const revokeMut = useMutation({
    mutationFn: (v: { user_id: string; role: StaffRole }) => revokeFn({ data: v }),
    onSuccess: () => { toast.success("Role revoked"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const grantMut = useMutation({
    mutationFn: (v: { user_id: string; role: StaffRole }) => grantFn({ data: v }),
    onSuccess: () => { toast.success("Role granted"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const zoneMut = useMutation({
    mutationFn: (v: { user_id: string; zone_id: string; assigned: boolean }) => setZoneFn({ data: v }),
    onSuccess: () => { toast.success("Zone updated"); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const resetMut = useMutation({
    mutationFn: (email: string) => resetFn({ data: { email } }),
    onSuccess: () => toast.success("Password reset email sent"),
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const staff = staffQ.data?.staff ?? [];
  const zones = zonesQ.data?.zones ?? [];
  const availableRoles = callerIsAdmin ? ASSIGNABLE_ROLES : ASSIGNABLE_ROLES.filter((r) => r !== "admin");

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-lg font-semibold text-slate-900">Staff & Permissions</h3>
        <p className="mt-1 text-sm text-slate-600">
          Assign administrative and dispatch roles. {callerIsAdmin
            ? "You can grant every role, including Administrator."
            : "As App Manager you can manage all roles except Administrator."}
        </p>
      </div>

      {/* Grant by email */}
      <div className="border-b border-slate-100 px-5 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Grant role by email</div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[220px] text-sm">
            <span className="mb-1 block text-slate-600">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">Role</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              {availableRoles.map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => inviteMut.mutate()}
            disabled={!email || inviteMut.isPending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {inviteMut.isPending ? "Granting…" : "Grant role"}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">{ROLE_DESCRIPTIONS[role]}</p>
      </div>

      {/* Staff list */}
      <div className="px-5 py-4">
        <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Current staff</div>
        {staffQ.isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : staff.length === 0 ? (
          <p className="text-sm text-slate-500">No staff yet.</p>
        ) : (
          <ul className="space-y-3">
            {staff.map((s: any) => {
              const canEditAdmin = callerIsAdmin;
              return (
                <li key={s.user_id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-medium text-slate-900">
                        {s.name ?? "(no name)"} <span className="ml-2 text-xs text-slate-500">{s.display_id ?? ""}</span>
                      </div>
                      <div className="text-xs text-slate-500">{s.phone ?? ""}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {s.roles.map((r: StaffRole) => (
                        <span key={r} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs">
                          {ROLE_LABELS[r] ?? r}
                          {(canEditAdmin || r !== "admin") && (
                            <button
                              type="button"
                              onClick={() => revokeMut.mutate({ user_id: s.user_id, role: r })}
                              className="text-slate-400 hover:text-red-600"
                              title="Revoke"
                            >×</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Add role */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {availableRoles
                      .filter((r) => !s.roles.includes(r))
                      .map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => grantMut.mutate({ user_id: s.user_id, role: r })}
                          className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-600 hover:border-slate-500"
                        >
                          + {ROLE_LABELS[r]}
                        </button>
                      ))}
                  </div>

                  {/* Zone assignments (only meaningful for zone managers) */}
                  {s.roles.includes("zone_manager" as StaffRole) && (
                    <div className="mt-3 border-t border-slate-100 pt-2">
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned zones</div>
                      <div className="flex flex-wrap gap-1">
                        {zones.map((z: any) => {
                          const assigned = s.zones.some((za: any) => za.zone_id === z.id);
                          return (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() =>
                                zoneMut.mutate({ user_id: s.user_id, zone_id: z.id, assigned: !assigned })
                              }
                              className={`rounded-full px-2 py-0.5 text-xs ${
                                assigned
                                  ? "bg-slate-900 text-white"
                                  : "border border-dashed border-slate-300 text-slate-600 hover:border-slate-500"
                              }`}
                            >
                              {z.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const em = window.prompt("Enter this user's email to send a password reset link");
                        if (em) resetMut.mutate(em);
                      }}
                      className="text-xs text-slate-600 underline hover:text-slate-900"
                    >
                      Send password reset
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

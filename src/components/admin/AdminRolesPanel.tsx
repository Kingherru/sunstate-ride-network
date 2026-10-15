import { useQuery } from "@tanstack/react-query";
import { getAccessState } from "@/lib/access.functions";
import { StaffPermissionsPanel } from "@/components/StaffPermissionsPanel";

/**
 * Admin management. Only the Master Admin may grant or remove the Administrator role;
 * the database enforces this and logs every role change. Nobody can change the Master Admin.
 */
export function AdminRolesPanel() {
  const q = useQuery({ queryKey: ["access-state"], queryFn: () => getAccessState() });
  if (!q.data) return <p className="ds-support" role="status">Loading…</p>;
  const master = q.data.isMasterAdmin;
  return (
    <section aria-labelledby="roles-h" className="space-y-4">
      <div>
        <h2 id="roles-h" className="ds-subheading uppercase text-ds-primary">Staff &amp; admin roles</h2>
        <p className="ds-support mt-1">
          {master
            ? "You are the Master Admin. You can add or remove admins and staff roles. Every change asks for confirmation and is logged."
            : "Only the Master Admin can add or remove admins. You can manage other staff roles."}
        </p>
      </div>
      <StaffPermissionsPanel callerIsAdmin={master} />
    </section>
  );
}

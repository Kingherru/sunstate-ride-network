import { useRouteContext } from "@tanstack/react-router";
import { resolveAdminLevel, type AccessLevel, type AdminSection, type AdminPerms } from "@/lib/admin-permissions";

/** Reads the signed-in admin's permission set from the /admin route context
 *  and resolves the effective access level for a section. Master Admin is
 *  always "manage". Safe to call from any component mounted under /admin. */
export function useAdminLevel(section: AdminSection): AccessLevel {
  const perms = useRouteContext({ from: "/_authenticated/admin", select: (c: any) => c.perms as AdminPerms }) as AdminPerms;
  return resolveAdminLevel(perms, section);
}

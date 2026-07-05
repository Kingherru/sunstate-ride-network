import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type StaffRole = "admin" | "app_manager" | "zone_manager" | "dispatcher" | "staff";

export type Capabilities = {
  loaded: boolean;
  roles: StaffRole[];
  email: string | null;
  userId: string | null;
  isAdmin: boolean;
  isAppManager: boolean;
  isZoneManager: boolean;
  isDispatcher: boolean;
  isStaff: boolean;
  isOps: boolean;
  // Feature flags
  canManageStaff: boolean;              // grant/revoke non-admin roles
  canManageAdmins: boolean;             // grant/revoke admin role
  canConfigurePricing: boolean;         // pricing averages, theme, system settings
  canManageZones: boolean;              // create zones, edit ZIP mappings
  canReviewProviders: boolean;          // approve/deny provider applications
  canDispatch: boolean;                 // create/edit/reassign/cancel trips
  canViewAuditLog: boolean;
  canAccessLovable: boolean;            // admin-only; hard-coded functionality
};

export function computeCaps(roles: StaffRole[], email: string | null, userId: string | null): Capabilities {
  const isAdmin = roles.includes("admin");
  const isAppManager = roles.includes("app_manager");
  const isZoneManager = roles.includes("zone_manager");
  const isDispatcher = roles.includes("dispatcher");
  const isStaff = roles.includes("staff");
  const isOps = isAdmin || isAppManager || isZoneManager || isDispatcher || isStaff;
  return {
    loaded: true,
    roles, email, userId,
    isAdmin, isAppManager, isZoneManager, isDispatcher, isStaff, isOps,
    canManageStaff: isAdmin || isAppManager,
    canManageAdmins: isAdmin,
    canConfigurePricing: isAdmin || isAppManager,
    canManageZones: isAdmin || isAppManager,
    canReviewProviders: isAdmin || isAppManager || isZoneManager,
    canDispatch: isAdmin || isAppManager || isZoneManager || isDispatcher,
    canViewAuditLog: isAdmin || isAppManager,
    canAccessLovable: isAdmin,
  };
}

const EMPTY: Capabilities = computeCaps([], null, null);

export function useCapabilities(): Capabilities {
  const q = useQuery({
    queryKey: ["capabilities"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return computeCaps([], null, null);
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const roles = (data ?? []).map((r) => r.role as StaffRole);
      return computeCaps(roles, user.email ?? null, user.id);
    },
    staleTime: 30_000,
  });
  return q.data ?? { ...EMPTY, loaded: false };
}

/** Small inline UI element to render when a control is intentionally disabled. */
export function permissionMessage(cap: keyof Capabilities): string {
  const map: Record<string, string> = {
    canManageStaff: "Requires Administrator or App Manager.",
    canManageAdmins: "Only Administrators can change the Administrator role.",
    canConfigurePricing: "Requires Administrator or App Manager to change pricing and system settings.",
    canManageZones: "Requires Administrator or App Manager to edit dispatch zones.",
    canReviewProviders: "Requires Administrator, App Manager, or Zone Manager to review provider applications.",
    canDispatch: "Requires a Dispatcher, Zone Manager, App Manager, or Administrator role.",
    canViewAuditLog: "Requires Administrator or App Manager to view the audit log.",
    canAccessLovable: "Restricted: only Administrators can access Lovable and hard-coded functionality.",
  };
  return map[cap as string] ?? "You don't have permission to perform this action.";
}

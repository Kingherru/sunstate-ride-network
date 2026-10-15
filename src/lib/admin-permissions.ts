/** Regular-admin permission model (browser-safe). The database functions
 *  admin_can / admin_can_account are the enforcement authority. */
export const ADMIN_SECTIONS = [
  { key: "people", label: "People & Accounts" },
  { key: "requests", label: "Requests & Trips" },
  { key: "classify", label: "Account classification" },
  { key: "schedule", label: "Schedules" },
  { key: "messaging", label: "Messaging" },
  { key: "notifications", label: "Notifications" },
  { key: "pricing", label: "Pricing" },
  { key: "payouts", label: "Payouts" },
  { key: "membership", label: "Membership & billing" },
  { key: "integrations", label: "Integrations" },
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number]["key"];
export const ADMIN_SECTION_KEYS = ADMIN_SECTIONS.map((s) => s.key) as [AdminSection, ...AdminSection[]];
export type AccessLevel = "none" | "read" | "manage";
export type SectionMap = Partial<Record<AdminSection, AccessLevel>>;
export type AdminPreset = "none" | "support" | "operations" | "finance" | "custom";

/** Starting templates only. Security and administrator management are never
 *  grantable — they stay with the Master Admin. */
export const PRESETS: Record<Exclude<AdminPreset, "custom">, SectionMap> = {
  none: {},
  support: { people: "read", messaging: "manage", notifications: "manage" },
  operations: { people: "read", requests: "manage", schedule: "read", messaging: "manage", notifications: "manage" },
  finance: { people: "read", pricing: "manage", payouts: "read", membership: "read" },
};
export const PRESET_LABELS: Record<AdminPreset, string> = {
  none: "No access", support: "Support Admin", operations: "Operations Admin", finance: "Finance Admin", custom: "Custom",
};

export function levelAllows(level: AccessLevel | undefined, need: "read" | "manage") {
  return need === "read" ? level === "read" || level === "manage" : level === "manage";
}

/** Admin nav sections and what they require. Security stays Master-only. */
export const ADMIN_NAV_REQUIREMENT: Record<string, AdminSection | "master" | null> = {
  "/admin": null,
  "/admin/people": "people",
  "/admin/requests": "requests",
  "/admin/on-behalf": "requests",
  "/admin/messaging": "messaging",
  "/admin/pricing": "pricing",
  "/admin/payouts": "payouts",
  "/admin/integrations": "integrations",
  "/admin/notifications": "notifications",
  "/admin/security": "master",
  "/admin/admins": "master",
};

export type AdminPerms = { master: boolean; sections: Record<string, string>; scope: string };

export function canOpen(path: string, p: AdminPerms) {
  if (p.master) return true;
  const key = Object.keys(ADMIN_NAV_REQUIREMENT).sort((a, b) => b.length - a.length).find((k) => path === k || path.startsWith(k + "/"));
  const need = key ? ADMIN_NAV_REQUIREMENT[key] : "master";
  if (need === null) return true;
  if (need === "master") return false;
  const lvl = p.sections[need] as AccessLevel | undefined;
  return path.startsWith("/admin/on-behalf") ? levelAllows(lvl, "manage") : levelAllows(lvl, "read");
}


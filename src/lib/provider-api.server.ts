// Server-only read-only provider API helpers. Keys arrive only via Authorization: Bearer.
import { z } from "zod";

export const API_VERSION = "2026-11-v1";
const RATE_LIMIT_PER_MINUTE = 60;
const MAX_RANGE_DAYS = 31;
type Scope = "schedule:read" | "exports:read";

const generic = (status: number, error: string) =>
  Response.json({ version: API_VERSION, error }, { status, headers: { "Cache-Control": "no-store" } });
export const unauthorized = () => generic(401, "unauthorized");

async function sha256(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export type ApiAuth = { credentialId: string; workspaceId: string; admin: any };

/** Returns auth context, or a generic error Response. Never echoes the key. */
export async function authenticate(request: Request, scope: Scope, endpoint: string): Promise<ApiAuth | Response> {
  const header = request.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(mfn_live_[0-9a-f]{64})$/.exec(header.trim());
  if (!m) return unauthorized();
  const secret = m[1];
  const hash = await sha256(secret);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as any;
  const { data: key } = await admin.from("provider_api_credentials")
    .select("id, workspace_id, scopes, status, secret_hash, key_prefix").eq("key_prefix", secret.slice(0, 13)).eq("status", "active");
  const match = ((key ?? []) as any[]).find((k) => safeEqual(k.secret_hash, hash));
  if (!match) return unauthorized();
  const { data: ws } = await admin.from("workspaces").select("id, account_type, status").eq("id", match.workspace_id).maybeSingle();
  if (!ws || ws.account_type !== "provider" || ws.status !== "active") return unauthorized();
  if (!(match.scopes as string[]).includes(scope)) {
    await admin.from("provider_api_access_events").insert({ credential_id: match.id, workspace_id: match.workspace_id, endpoint, outcome: "forbidden" });
    return unauthorized();
  }
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from("provider_api_access_events").select("id", { count: "exact", head: true }).eq("credential_id", match.id).gte("created_at", since);
  if ((count ?? 0) >= RATE_LIMIT_PER_MINUTE) {
    await admin.from("provider_api_access_events").insert({ credential_id: match.id, workspace_id: match.workspace_id, endpoint, outcome: "rate_limited" });
    return new Response(JSON.stringify({ version: API_VERSION, error: "rate_limited" }), { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "60", "Cache-Control": "no-store" } });
  }
  await admin.from("provider_api_access_events").insert({ credential_id: match.id, workspace_id: match.workspace_id, endpoint, outcome: "ok" });
  await admin.from("provider_api_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", match.id);
  return { credentialId: match.id, workspaceId: match.workspace_id, admin };
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const rangeQuery = z.object({
  start: day, end: day.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(100),
}).transform((v) => ({ ...v, end: v.end ?? v.start }))
  .refine((v) => v.end >= v.start && (Date.parse(v.end) - Date.parse(v.start)) / 86_400_000 <= MAX_RANGE_DAYS);

export function parseRange(url: URL) {
  const r = rangeQuery.safeParse(Object.fromEntries(url.searchParams));
  return r.success ? r.data : null;
}

export type ScheduleItem = {
  trip_reference: string; date: string; pickup_time: string | null; scheduled_start_time: string | null;
  trip_type: string; service_level: string | null; transport_type: string | null; status: string | null;
  assignment_status: "assigned" | "unassigned"; driver: string | null; vehicle: string | null;
  pickup: string; destination: string;
};

/** Only trips owned by/accepted into the credential's workspace. No PHI beyond dispatch addresses. */
export async function loadSchedule(auth: ApiAuth, r: { start: string; end: string; page: number; page_size: number }) {
  const from = (r.page - 1) * r.page_size;
  const { data, count } = await auth.admin.from("trips")
    .select("id, trip_number, display_id, pickup_date, pickup_time, scheduled_start_time, round_trip, trip_kind, service_level, transport_type, status, driver_id, vehicle_id, pickup_address, pickup_city, pickup_zip, dropoff_address, dropoff_city, dropoff_zip", { count: "exact" })
    .eq("network_provider_workspace_id", auth.workspaceId).gte("pickup_date", r.start).lte("pickup_date", r.end)
    .order("pickup_date").order("pickup_time").range(from, from + r.page_size - 1);
  const rows = (data ?? []) as any[];
  const dIds = [...new Set(rows.map((t) => t.driver_id).filter(Boolean))];
  const vIds = [...new Set(rows.map((t) => t.vehicle_id).filter(Boolean))];
  const { data: ds } = dIds.length ? await auth.admin.from("drivers").select("id, first_name, last_name").eq("workspace_id", auth.workspaceId).in("id", dIds) : { data: [] };
  const { data: vs } = vIds.length ? await auth.admin.from("vehicles").select("id, name").eq("workspace_id", auth.workspaceId).in("id", vIds) : { data: [] };
  const dm = new Map(((ds ?? []) as any[]).map((d) => [d.id, `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim()]));
  const vm = new Map(((vs ?? []) as any[]).map((v) => [v.id, v.name]));
  const items: ScheduleItem[] = rows.map((t) => ({
    trip_reference: String(t.display_id ?? t.trip_number ?? t.id.slice(0, 8).toUpperCase()),
    date: t.pickup_date, pickup_time: t.pickup_time ?? null, scheduled_start_time: t.scheduled_start_time ?? null,
    trip_type: t.round_trip ? "round_trip" : (t.trip_kind ?? "one_way"),
    service_level: t.service_level ?? null, transport_type: t.transport_type ?? null, status: t.status ?? null,
    assignment_status: t.driver_id ? "assigned" : "unassigned",
    driver: t.driver_id ? dm.get(t.driver_id) ?? null : null, vehicle: t.vehicle_id ? vm.get(t.vehicle_id) ?? null : null,
    pickup: [t.pickup_address, t.pickup_city, t.pickup_zip].filter(Boolean).join(", "),
    destination: [t.dropoff_address, t.dropoff_city, t.dropoff_zip].filter(Boolean).join(", "),
  }));
  return { items, total: count ?? items.length };
}

export function toCsv(items: ScheduleItem[]) {
  const cols = Object.keys(items[0] ?? { trip_reference: "" }) as (keyof ScheduleItem)[];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe; };
  return [cols.join(","), ...items.map((i) => cols.map((c) => esc(i[c])).join(","))].join("\n");
}

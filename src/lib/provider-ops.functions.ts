import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const UNAVAILABLE = "This action is unavailable.";
type Db = any;

/** Server-resolved provider workspace where the caller is owner/admin (never browser-supplied). */
async function managedWorkspace(db: Db, userId: string): Promise<{ id: string; mfn: string | null }> {
  const { data } = await db.from("workspace_members").select("workspace_id, role, workspaces!inner(account_type, status, mfn_id)")
    .eq("user_id", userId).is("removed_at", null).eq("is_contractor", false);
  const own = (data ?? []).filter((m: any) => ["owner", "admin"].includes(m.role) && m.workspaces.account_type === "provider" && m.workspaces.status === "active");
  if (own.length !== 1) throw new Error(UNAVAILABLE);
  return { id: own[0].workspace_id, mfn: own[0].workspaces.mfn_id ?? null };
}

/* ---------- Fleet status ---------- */
export const setFleetResourceStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ kind: z.enum(["driver", "vehicle"]), id: z.string().uuid(), status: z.enum(["active", "inactive"]), reason: z.string().trim().min(3).max(500) }).parse(v))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("set_fleet_resource_status" as never, { _kind: data.kind, _id: data.id, _status: data.status, _reason: data.reason } as never);
    if (error) throw new Error(UNAVAILABLE);
    return { ok: true };
  });

export const listFleetStatusHistory = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ kind: z.enum(["driver", "vehicle"]), id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const { data: rows } = await (context.supabase as Db).from("fleet_resource_status_events")
      .select("id, previous_status, new_status, reason, actor_mfn_id, resource_reference, created_at")
      .eq("resource_kind", data.kind).eq("resource_id", data.id).order("created_at", { ascending: false }).limit(50);
    return (rows ?? []) as { id: string; previous_status: string | null; new_status: string; reason: string; actor_mfn_id: string | null; resource_reference: string | null; created_at: string }[];
  });

/* ---------- Earnings ledger (integer cents, server totals) ---------- */
const ledgerInput = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  driverId: z.string().uuid().nullable().optional(), category: z.enum(["all", "adjustment", "payment"]).default("all"),
  status: z.string().max(40).default("all"),
}).refine((v) => v.end >= v.start);
export type LedgerRow = { id: string; date: string; driver: string; employment: string; category: "adjustment" | "payment"; status: string; amountCents: number; reference: string };

/** RLS limits drivers/adjustments/payments: owners see workspace drivers, contractors only their own linked driver record. */
export const listEarningsLedger = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => ledgerInput.parse(v))
  .handler(async ({ data, context }) => {
    const db = context.supabase as Db;
    const { data: drivers } = await db.from("drivers").select("id, first_name, last_name, employment_type, owner_id, user_id, workspace_id");
    const visible = ((drivers ?? []) as any[]).filter((d) => d.owner_id === context.userId || d.user_id === context.userId || d.workspace_id);
    const ids = visible.map((d) => d.id).filter((id) => !data.driverId || id === data.driverId);
    const names = new Map(visible.map((d) => [d.id, d]));
    const rows: LedgerRow[] = [];
    if (ids.length) {
      if (data.category !== "payment") {
        const { data: adj } = await db.from("driver_earning_adjustments").select("id, driver_id, applied_on, amount_cents, reason").in("driver_id", ids).gte("applied_on", data.start).lte("applied_on", data.end);
        for (const a of adj ?? []) rows.push({ id: a.id, date: a.applied_on, driver: "", employment: "", category: "adjustment", status: "recorded", amountCents: Math.trunc(Number(a.amount_cents) || 0), reference: String(a.reason ?? "").slice(0, 80), ...{ _d: a.driver_id } } as any);
      }
      if (data.category !== "adjustment") {
        const { data: pay } = await db.from("driver_payments").select("id, driver_id, paid_at, created_at, amount_paid_cents, status, reference, method").in("driver_id", ids);
        for (const p of pay ?? []) {
          const date = String(p.paid_at ?? p.created_at).slice(0, 10);
          if (date < data.start || date > data.end) continue;
          rows.push({ id: p.id, date, driver: "", employment: "", category: "payment", status: p.status ?? "recorded", amountCents: Math.trunc(Number(p.amount_paid_cents) || 0), reference: String(p.reference ?? p.method ?? "").slice(0, 40), ...{ _d: p.driver_id } } as any);
        }
      }
    }
    const out = rows.map((r: any) => { const d = names.get(r._d); const { _d, ...rest } = r; return { ...rest, driver: d ? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() : "Not available", employment: d?.employment_type === "independent_contractor" ? "Contractor" : d?.employment_type ? "Employee" : "Not provided" } as LedgerRow; })
      .filter((r) => data.status === "all" || r.status === data.status)
      .sort((a, b) => b.date.localeCompare(a.date));
    const totals = {
      adjustmentsCents: out.filter((r) => r.category === "adjustment").reduce((s, r) => s + r.amountCents, 0),
      paymentsCents: out.filter((r) => r.category === "payment").reduce((s, r) => s + r.amountCents, 0),
    };
    let workspaceMfn: string | null = null;
    try { workspaceMfn = (await managedWorkspace(db, context.userId)).mfn; } catch { workspaceMfn = null; }
    return { rows: out, totals, workspaceMfn, drivers: visible.map((d) => ({ id: d.id, name: `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim() })) };
  });

/* ---------- Provider API credentials (hash-only) ---------- */
const SCOPES = ["exports:read", "schedule:read"] as const;
async function sha256(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const body = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `mfn_live_${body}`;
}
async function actorMfn(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("user_profiles").select("mfn_id").eq("id", userId).maybeSingle();
  return { admin: supabaseAdmin as Db, mfn: (data?.mfn_id as string | null) ?? null };
}

export const listApiCredentials = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = context.supabase as Db;
    let ws: { id: string };
    try { ws = await managedWorkspace(db, context.userId); } catch { return { allowed: false, keys: [], events: [] }; }
    const { data: keys } = await db.from("provider_api_credentials").select("id, name, scopes, key_prefix, key_last4, status, created_by_mfn_id, created_at, last_used_at, rotated_at, revoked_at, revoked_by_mfn_id").eq("workspace_id", ws.id).order("created_at", { ascending: false });
    const { data: events } = await db.from("provider_api_credential_events").select("id, credential_id, event, detail, actor_mfn_id, created_at").eq("workspace_id", ws.id).order("created_at", { ascending: false }).limit(50);
    return { allowed: true, keys: (keys ?? []) as any[], events: (events ?? []) as any[] };
  });

async function issue(admin: Db, ws: string, name: string, scopes: string[], userId: string, mfn: string | null) {
  const secret = newSecret();
  const { data, error } = await admin.from("provider_api_credentials").insert({
    workspace_id: ws, name, scopes, secret_hash: await sha256(secret), key_prefix: secret.slice(0, 13), key_last4: secret.slice(-4), created_by: userId, created_by_mfn_id: mfn,
  }).select("id").single();
  if (error || !data) throw new Error(UNAVAILABLE);
  return { id: data.id as string, secret };
}

export const createApiCredential = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ name: z.string().trim().min(2).max(80), scopes: z.array(z.enum(SCOPES)).min(1) }).parse(v))
  .handler(async ({ data, context }) => {
    const ws = await managedWorkspace(context.supabase, context.userId);
    const { admin, mfn } = await actorMfn(context.userId);
    const out = await issue(admin, ws.id, data.name, data.scopes, context.userId, mfn);
    await admin.from("provider_api_credential_events").insert({ credential_id: out.id, workspace_id: ws.id, event: "created", detail: data.scopes.join(","), actor_user_id: context.userId, actor_mfn_id: mfn });
    return { id: out.id, secret: out.secret }; // shown once; never retrievable again
  });

async function ownedKey(admin: Db, ws: string, id: string) {
  const { data } = await admin.from("provider_api_credentials").select("id, name, scopes, status").eq("id", id).eq("workspace_id", ws).maybeSingle();
  if (!data) throw new Error(UNAVAILABLE);
  return data as { id: string; name: string; scopes: string[]; status: string };
}

export const renameApiCredential = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid(), name: z.string().trim().min(2).max(80) }).parse(v))
  .handler(async ({ data, context }) => {
    const ws = await managedWorkspace(context.supabase, context.userId);
    const { admin, mfn } = await actorMfn(context.userId);
    const k = await ownedKey(admin, ws.id, data.id);
    await admin.from("provider_api_credentials").update({ name: data.name }).eq("id", k.id);
    await admin.from("provider_api_credential_events").insert({ credential_id: k.id, workspace_id: ws.id, event: "renamed", detail: data.name, actor_user_id: context.userId, actor_mfn_id: mfn });
    return { ok: true };
  });

export const revokeApiCredential = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const ws = await managedWorkspace(context.supabase, context.userId);
    const { admin, mfn } = await actorMfn(context.userId);
    const k = await ownedKey(admin, ws.id, data.id);
    if (k.status !== "active") return { ok: true };
    await admin.from("provider_api_credentials").update({ status: "revoked", revoked_at: new Date().toISOString(), revoked_by_mfn_id: mfn }).eq("id", k.id);
    await admin.from("provider_api_credential_events").insert({ credential_id: k.id, workspace_id: ws.id, event: "revoked", actor_user_id: context.userId, actor_mfn_id: mfn });
    return { ok: true };
  });

export const rotateApiCredential = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    const ws = await managedWorkspace(context.supabase, context.userId);
    const { admin, mfn } = await actorMfn(context.userId);
    const k = await ownedKey(admin, ws.id, data.id);
    if (k.status !== "active") throw new Error(UNAVAILABLE);
    const out = await issue(admin, ws.id, k.name, k.scopes, context.userId, mfn);
    const now = new Date().toISOString();
    await admin.from("provider_api_credentials").update({ status: "revoked", revoked_at: now, rotated_at: now, revoked_by_mfn_id: mfn, replaced_by: out.id }).eq("id", k.id);
    await admin.from("provider_api_credential_events").insert({ credential_id: k.id, workspace_id: ws.id, event: "rotated", detail: `replaced by ${out.id.slice(0, 8)}`, actor_user_id: context.userId, actor_mfn_id: mfn });
    return { id: out.id, secret: out.secret };
  });

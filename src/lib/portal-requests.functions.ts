import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Portal + admin request reads. Every read runs as the signed-in user, so the
 * database's row-level rules decide what is visible (own requests, workspace
 * requests where the member has explicit permission, or verified admin).
 * Unknown and unauthorized IDs return the same "not found" result.
 */

const LIST_COLS = "id, trip_kind, transport_type, trip_type, status, created_at, submitted_via";
const DETAIL_COLS =
  "id, trip_kind, transport_type, trip_type, status, created_at, submitted_via, pickup_date, pickup_time, appointment_time, pickup_address, pickup_address_details, pickup_city, dropoff_address, dropoff_city, round_trip, return_date, return_pickup_time, additional_stops, recurrence_rule, recurrence_end_date, patient_first_name, patient_last_name, patient_phone, patient_email, mobility_notes, special_instructions, delivery_item_type, delivery_instructions, delivery_signature_required";

export type RequestListRow = {
  id: string; trip_kind: string | null; transport_type: string | null; trip_type: string | null;
  status: string | null; created_at: string; submitted_via: string | null;
};
export type RequestDetailRow = RequestListRow & Record<string, unknown>;

const idInput = (input: unknown) => z.object({ id: z.string().uuid() }).parse(input);
const NOT_FOUND = "not_found";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

export const getPortalSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: ws } = await context.supabase
      .from("workspace_members")
      .select("role, workspaces!inner(display_name, account_type, status)")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    const w = (ws as any)?.workspaces;
    const { data: recent } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(5);
    return {
      email: (context.claims as any)?.email ?? null,
      workspace: w ? { name: w.display_name as string | null, type: w.account_type as string, status: w.status as string, role: (ws as any).role as string } : null,
      recent: (recent ?? []) as RequestListRow[],
    };
  });

export const listPortalRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(200);
    if (error) throw new Error("Could not load requests.");
    return (data ?? []) as RequestListRow[];
  });

export const getPortalRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("ride_requests").select(DETAIL_COLS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: NOT_FOUND };
    return { ok: true as const, request: row as unknown as RequestDetailRow };
  });

export const listAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("ride_requests").select(LIST_COLS).order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error("Could not load requests.");
    return (data ?? []) as RequestListRow[];
  });

export const getAdminRequest = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { data: row } = await context.supabase.from("ride_requests").select(DETAIL_COLS).eq("id", data.id).maybeSingle();
    if (!row) return { ok: false as const, error: NOT_FOUND };
    return { ok: true as const, request: row as unknown as RequestDetailRow };
  });

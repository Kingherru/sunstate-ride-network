import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** List all threads the current user participates in, with last message + unread count. */
export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: parts, error: pErr } = await supabase
      .from("thread_participants")
      .select("thread_id, last_read_at")
      .eq("user_id", userId);
    if (pErr) return { ok: false as const, error: pErr.message };
    const threadIds = (parts ?? []).map((p: any) => p.thread_id);
    if (threadIds.length === 0) return { ok: true as const, threads: [] };
    const readMap = new Map((parts ?? []).map((p: any) => [p.thread_id, p.last_read_at]));

    const { data: threads } = await supabase
      .from("message_threads")
      .select("id, subject, created_by, last_message_at, created_at")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false });

    // Other participants
    const { data: allParts } = await supabase
      .from("thread_participants")
      .select("thread_id, user_id")
      .in("thread_id", threadIds);

    const otherIds = Array.from(new Set((allParts ?? []).filter((p: any) => p.user_id !== userId).map((p: any) => p.user_id)));
    const profByUser = new Map<string, any>();
    if (otherIds.length) {
      const { data: profs } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, display_id, company_name")
        .in("user_id", otherIds);
      (profs ?? []).forEach((p: any) => profByUser.set(p.user_id, p));
    }

    // last message + unread count per thread
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, thread_id, sender_id, body, created_at")
      .in("thread_id", threadIds)
      .order("created_at", { ascending: false });
    const lastByThread = new Map<string, any>();
    const unreadByThread = new Map<string, number>();
    for (const m of (msgs ?? []) as any[]) {
      if (!lastByThread.has(m.thread_id)) lastByThread.set(m.thread_id, m);
      const lastRead = readMap.get(m.thread_id);
      if (m.sender_id !== userId && (!lastRead || new Date(m.created_at) > new Date(lastRead))) {
        unreadByThread.set(m.thread_id, (unreadByThread.get(m.thread_id) ?? 0) + 1);
      }
    }

    const enriched = (threads ?? []).map((t: any) => {
      const others = (allParts ?? [])
        .filter((p: any) => p.thread_id === t.id && p.user_id !== userId)
        .map((p: any) => {
          const prof = profByUser.get(p.user_id) ?? {};
          const name = [prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.company_name || prof.display_id || "Member";
          return { user_id: p.user_id, name, company: prof.company_name ?? null, display_id: prof.display_id ?? null };
        });
      return {
        ...t,
        participants: others,
        last_message: lastByThread.get(t.id) ?? null,
        unread_count: unreadByThread.get(t.id) ?? 0,
      };
    });
    return { ok: true as const, threads: enriched };
  });

/** Get messages for a thread + mark as read. */
export const getThreadMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { thread_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: msgs, error } = await supabase
      .from("messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", data.thread_id)
      .order("created_at", { ascending: true });
    if (error) return { ok: false as const, error: error.message };
    await supabase
      .from("thread_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.thread_id)
      .eq("user_id", userId);
    return { ok: true as const, messages: msgs ?? [] };
  });

/** Send a message in an existing thread. */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { thread_id: string; body: string }) => input)
  .handler(async ({ data, context }) => {
    const body = (data.body ?? "").trim();
    if (!body) return { ok: false as const, error: "Message body required." };
    if (body.length > 5000) return { ok: false as const, error: "Message too long." };
    const { error } = await context.supabase.from("messages").insert({
      thread_id: data.thread_id,
      sender_id: context.userId,
      body,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/** Start or open a 1:1 thread with another user (permission-checked). */
export const startDirectThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { recipient_user_id: string; initial_body?: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: threadId, error } = await context.supabase.rpc("start_direct_thread", {
      _recipient: data.recipient_user_id,
    });
    if (error) return { ok: false as const, error: error.message };
    const body = (data.initial_body ?? "").trim();
    if (body) {
      await context.supabase.from("messages").insert({
        thread_id: threadId,
        sender_id: context.userId,
        body,
      });
    }
    return { ok: true as const, thread_id: threadId as string };
  });

/** Discover other users the caller is allowed to message. Filters:
 *  - "staff": all staff members (admins, dispatchers, managers)
 *  - "providers": subscribed providers directory (public listing among providers)
 *  - "my_providers": providers the (patient) caller has an existing relationship with
 */
export const discoverContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "staff" | "providers" | "my_providers"; search?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const search = (data.search ?? "").trim().toLowerCase();

    if (data.kind === "staff") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "app_manager", "zone_manager", "dispatcher", "staff"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))).filter((id) => id !== userId);
      if (ids.length === 0) return { ok: true as const, contacts: [] };
      const { data: profs } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, display_id, company_name")
        .in("user_id", ids);
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r: any) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      const contacts = (profs ?? []).map((p: any) => ({
        user_id: p.user_id,
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_id || "Staff",
        subtitle: (rolesByUser.get(p.user_id) ?? []).join(", "),
        display_id: p.display_id,
        company: p.company_name,
      })).filter((c) => !search || c.name.toLowerCase().includes(search) || (c.company ?? "").toLowerCase().includes(search));
      return { ok: true as const, contacts };
    }

    if (data.kind === "providers") {
      // Subscribed provider directory
      const { data: profs } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, display_id, company_name, service_radius_miles, preferred_zip_codes, membership_status, membership_tier")
        .eq("membership_status", "active")
        .eq("membership_tier", "paid")
        .limit(500);
      const contacts = (profs ?? [])
        .filter((p: any) => p.user_id !== userId)
        .map((p: any) => ({
          user_id: p.user_id,
          name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_id || "Provider",
          subtitle: p.display_id ?? "",
          zips: p.preferred_zip_codes ?? [],
          radius: p.service_radius_miles ?? null,
          display_id: p.display_id,
          company: p.company_name,
        }))
        .filter((c) => !search || c.name.toLowerCase().includes(search) || (c.subtitle ?? "").toLowerCase().includes(search));
      return { ok: true as const, contacts };
    }

    // my_providers: providers the caller has interacted with
    const [{ data: trips }, { data: reqs }] = await Promise.all([
      supabase.from("trips").select("assigned_to").eq("created_by", userId),
      supabase.from("ride_requests").select("assigned_provider_id").eq("requester_user_id", userId),
    ]);
    const provIds = new Set<string>();
    (trips ?? []).forEach((t: any) => { if (t.assigned_to) provIds.add(t.assigned_to); if (t.assigned_provider_id) provIds.add(t.assigned_provider_id); });
    (reqs ?? []).forEach((r: any) => { if (r.assigned_provider_id) provIds.add(r.assigned_provider_id); });
    const ids = Array.from(provIds).filter((id) => id !== userId);
    if (ids.length === 0) return { ok: true as const, contacts: [] };
    const { data: profs } = await supabase
      .from("member_profiles")
      .select("user_id, first_name, last_name, display_id, company_name")
      .in("user_id", ids);
    const contacts = (profs ?? []).map((p: any) => ({
      user_id: p.user_id,
      name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_id || "Provider",
      subtitle: p.display_id ?? "",
      display_id: p.display_id,
      company: p.company_name,
    })).filter((c) => !search || c.name.toLowerCase().includes(search));
    return { ok: true as const, contacts };
  });

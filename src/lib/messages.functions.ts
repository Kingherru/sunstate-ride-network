import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Relationship =
  | "staff"
  | "dispatch"
  | "zone_manager"
  | "feedback_admin"
  | "provider_network"
  | "prior_trip"
  | "subscription"
  | "unknown";

function relationshipLabel(r: Relationship): string {
  if (r === "staff") return "Staff";
  if (r === "dispatch") return "Dispatch";
  if (r === "zone_manager") return "Zone Manager";
  if (r === "feedback_admin") return "Feedback · Admin";
  if (r === "provider_network") return "Provider Network";
  if (r === "prior_trip") return "Prior Trip";
  if (r === "subscription") return "Subscription";
  return "Direct";
}

/** List all threads the current user participates in, with last message + unread + relationship. */
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
    if (threadIds.length === 0) return { ok: true as const, threads: [], total_unread: 0 };
    const readMap = new Map((parts ?? []).map((p: any) => [p.thread_id, p.last_read_at]));

    const { data: threads } = await supabase
      .from("message_threads")
      .select("id, subject, created_by, last_message_at, created_at, kind, zone_id, feedback_id")
      .in("id", threadIds)
      .order("last_message_at", { ascending: false });

    const { data: allParts } = await supabase
      .from("thread_participants")
      .select("thread_id, user_id")
      .in("thread_id", threadIds);

    const otherIds = Array.from(new Set((allParts ?? []).filter((p: any) => p.user_id !== userId).map((p: any) => p.user_id)));
    const profByUser = new Map<string, any>();
    const staffSet = new Set<string>();
    const paidProviderSet = new Set<string>();
    const priorTripSet = new Set<string>();

    if (otherIds.length) {
      const [{ data: profs }, { data: roles }, { data: trips }, { data: reqs }] = await Promise.all([
        supabase
          .from("member_profiles")
          .select("user_id, first_name, last_name, display_id, company_name, city, membership_status, membership_tier")
          .in("user_id", otherIds),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("user_id", otherIds)
          .in("role", ["admin", "app_manager", "zone_manager", "dispatcher", "staff"]),
        supabase
          .from("trips")
          .select("assigned_to, created_by")
          .or(`created_by.eq.${userId},assigned_to.eq.${userId}`),
        supabase
          .from("ride_requests")
          .select("requester_user_id, assigned_provider_id")
          .or(`requester_user_id.eq.${userId},assigned_provider_id.eq.${userId}`),
      ]);
      (profs ?? []).forEach((p: any) => {
        profByUser.set(p.user_id, p);
        if (p.membership_status === "active" && p.membership_tier === "paid") paidProviderSet.add(p.user_id);
      });
      (roles ?? []).forEach((r: any) => staffSet.add(r.user_id));
      (trips ?? []).forEach((t: any) => {
        if (t.created_by === userId && t.assigned_to) priorTripSet.add(t.assigned_to);
        if (t.assigned_to === userId && t.created_by) priorTripSet.add(t.created_by);
      });
      (reqs ?? []).forEach((r: any) => {
        if (r.requester_user_id === userId && r.assigned_provider_id) priorTripSet.add(r.assigned_provider_id);
        if (r.assigned_provider_id === userId && r.requester_user_id) priorTripSet.add(r.requester_user_id);
      });
    }

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

    const iAmStaffRes = await supabase.rpc("is_ops_staff", { _user_id: userId });
    const iAmStaff = Boolean(iAmStaffRes.data);

    const enriched = (threads ?? []).map((t: any) => {
      const others = (allParts ?? [])
        .filter((p: any) => p.thread_id === t.id && p.user_id !== userId)
        .map((p: any) => {
          const prof = profByUser.get(p.user_id) ?? {};
          const name = [prof.first_name, prof.last_name].filter(Boolean).join(" ") || prof.company_name || prof.display_id || "Member";
          return {
            user_id: p.user_id,
            name,
            company: prof.company_name ?? null,
            display_id: prof.display_id ?? null,
            city: prof.city ?? null,
          };
        });
      let rel: Relationship = "unknown";
      const otherId = others[0]?.user_id;
      if (otherId) {
        if (staffSet.has(otherId) || iAmStaff) rel = "staff";
        else if (priorTripSet.has(otherId)) rel = "prior_trip";
        else if (paidProviderSet.has(otherId)) rel = "provider_network";
        else rel = "subscription";
      }
      return {
        ...t,
        participants: others,
        last_message: lastByThread.get(t.id) ?? null,
        unread_count: unreadByThread.get(t.id) ?? 0,
        relationship: rel,
        relationship_label: relationshipLabel(rel),
      };
    });
    const totalUnread = enriched.reduce((s, t) => s + t.unread_count, 0);
    return { ok: true as const, threads: enriched, total_unread: totalUnread };
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

/** Mark a thread as read without fetching messages (e.g., dismissal). */
export const markThreadRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { thread_id: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("thread_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("thread_id", data.thread_id)
      .eq("user_id", context.userId);
    return { ok: true as const };
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
    if (error) {
      const raw = (error.message ?? "").toLowerCase();
      let friendly = "We couldn't start this conversation.";
      if (raw.includes("permission")) {
        friendly =
          "You don't have permission to message this member yet. Messaging is limited to staff, subscribed providers on the network, and members you share a prior trip or subscription with.";
      } else if (raw.includes("not authenticated")) {
        friendly = "Please sign back in to send messages.";
      }
      return { ok: false as const, error: friendly };
    }
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

type SortKey = "name" | "company" | "city";
function sortContacts<T extends { name: string; company?: string | null; city?: string | null }>(
  arr: T[],
  key: SortKey,
): T[] {
  const get = (c: T) =>
    (key === "company" ? c.company : key === "city" ? c.city : c.name) ?? "";
  return [...arr].sort((a, b) => get(a).localeCompare(get(b), undefined, { sensitivity: "base" }));
}

/** Discover other users the caller is allowed to message. */
export const discoverContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "staff" | "providers" | "my_providers"; search?: string; sort?: SortKey }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const search = (data.search ?? "").trim().toLowerCase();
    const sort: SortKey = data.sort ?? "name";
    const matches = (c: { name: string; company?: string | null; city?: string | null; subtitle?: string }) => {
      if (!search) return true;
      const hay = [c.name, c.company ?? "", c.city ?? "", c.subtitle ?? ""].join(" ").toLowerCase();
      return hay.includes(search);
    };

    if (data.kind === "staff") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("role", ["admin", "app_manager", "zone_manager", "dispatcher", "staff"]);
      const ids = Array.from(new Set((roles ?? []).map((r: any) => r.user_id))).filter((id) => id !== userId);
      if (ids.length === 0) return { ok: true as const, contacts: [] };
      const { data: profs } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, display_id, company_name, city")
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
        company: p.company_name ?? null,
        city: p.city ?? null,
        relationship: "staff" as Relationship,
        relationship_label: "Staff",
      })).filter(matches);
      return { ok: true as const, contacts: sortContacts(contacts, sort) };
    }

    if (data.kind === "providers") {
      const { data: profs } = await supabase
        .from("member_profiles")
        .select("user_id, first_name, last_name, display_id, company_name, city, service_radius_miles, preferred_zip_codes, membership_status, membership_tier")
        .eq("membership_status", "active")
        .eq("membership_tier", "paid")
        .limit(500);
      const contacts = (profs ?? [])
        .filter((p: any) => p.user_id !== userId)
        .map((p: any) => ({
          user_id: p.user_id,
          name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_id || "Provider",
          subtitle: [p.display_id, p.city].filter(Boolean).join(" · "),
          display_id: p.display_id,
          company: p.company_name ?? null,
          city: p.city ?? null,
          relationship: "provider_network" as Relationship,
          relationship_label: "Provider Network",
        }))
        .filter(matches);
      return { ok: true as const, contacts: sortContacts(contacts, sort) };
    }

    // my_providers
    const [{ data: trips }, { data: reqs }] = await Promise.all([
      supabase.from("trips").select("assigned_to").eq("created_by", userId),
      supabase.from("ride_requests").select("assigned_provider_id").eq("requester_user_id", userId),
    ]);
    const provIds = new Set<string>();
    (trips ?? []).forEach((t: any) => { if (t.assigned_to) provIds.add(t.assigned_to); });
    (reqs ?? []).forEach((r: any) => { if (r.assigned_provider_id) provIds.add(r.assigned_provider_id); });
    const ids = Array.from(provIds).filter((id) => id !== userId);
    if (ids.length === 0) return { ok: true as const, contacts: [] };
    const { data: profs } = await supabase
      .from("member_profiles")
      .select("user_id, first_name, last_name, display_id, company_name, city")
      .in("user_id", ids);
    const contacts = (profs ?? []).map((p: any) => ({
      user_id: p.user_id,
      name: p.company_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.display_id || "Provider",
      subtitle: [p.display_id, p.city].filter(Boolean).join(" · "),
      display_id: p.display_id,
      company: p.company_name ?? null,
      city: p.city ?? null,
      relationship: "prior_trip" as Relationship,
      relationship_label: "Prior Trip",
    })).filter(matches);
    return { ok: true as const, contacts: sortContacts(contacts, sort) };
  });

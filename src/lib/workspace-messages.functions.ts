import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Business-to-business workspace messaging. Reads run as the signed-in user
 * so row-level security decides visibility (owner/admin, a flagged member of
 * an active workspace, or a verified admin with the messaging section).
 * Writes (creating conversations, sending, archiving) use the service-role
 * client ONLY after independently verifying `can_access_workspace_messages`
 * for the sender's workspace, since workspace_messages/conversations have no
 * authenticated INSERT/UPDATE policies.
 */

export type MessagingWorkspace = { id: string; name: string; mfnId: string | null; accountType: string; role: string };
export type ConversationRow = {
  id: string; otherWorkspaceId: string; otherName: string; otherMfnId: string | null;
  lastSenderName?: string | null; lastMessage: string | null; lastMessageAt: string | null; unreadCount: number; archived: boolean; isTest: boolean;
};
export type MessageRow = {
  id: string; senderWorkspaceId: string; recipientWorkspaceId: string; senderFirstName: string | null;
  body: string; createdAt: string; readAt: string | null;
};

async function assertCanAccess(context: any, workspaceId: string) {
  const { data } = await context.supabase.rpc("can_access_workspace_messages", { ws: workspaceId });
  if (data !== true) throw new Error("You don't have permission to message for that workspace.");
}

/** Workspaces the signed-in user may send/read messages for: owner, admin,
 *  or a member explicitly flagged `can_message_for_workspace`. */
export const listMyMessagingWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MessagingWorkspace[]> => {
    const { data, error } = await context.supabase
      .from("workspace_members")
      .select("role, can_message_for_workspace, workspaces!inner(id, display_name, mfn_id, account_type, status)")
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not load your workspaces.");
    const rows = (data ?? []) as any[];
    return rows
      .filter((r) => r.workspaces.status === "active" && (r.role === "owner" || r.role === "admin" || r.can_message_for_workspace))
      .map((r) => ({ id: r.workspaces.id, name: r.workspaces.display_name, mfnId: r.workspaces.mfn_id, accountType: r.workspaces.account_type, role: r.role }));
  });

const startInput = z.object({ senderWorkspaceId: z.string().uuid(), targetWorkspaceId: z.string().uuid() }).strict();

/** Opens (or finds) a conversation between a sender workspace and a Provider
 *  Network target. Target must be a verified, visible provider from
 *  `list_network_providers`, or — when the sender is a test account — any
 *  test-account provider workspace. */
export const startOrOpenConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => startInput.parse(i))
  .handler(async ({ data, context }) => {
    if (data.senderWorkspaceId === data.targetWorkspaceId) throw new Error("A workspace cannot message itself.");
    await assertCanAccess(context, data.senderWorkspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sender } = await supabaseAdmin.from("workspaces").select("id, is_test_account, status").eq("id", data.senderWorkspaceId).maybeSingle();
    if (!sender || sender.status !== "active") throw new Error("Your workspace isn't active.");
    const { data: target } = await supabaseAdmin.from("workspaces").select("id, account_type, is_test_account, status, provider_verified").eq("id", data.targetWorkspaceId).maybeSingle();
    if (!target || target.account_type !== "provider" || target.status !== "active") throw new Error("That business isn't available to message.");

    let allowed = false;
    if (sender.is_test_account && target.is_test_account) {
      allowed = true;
    } else {
      const { data: listed } = await context.supabase.rpc("list_network_providers", {});
      allowed = (listed ?? []).some((p: any) => p.workspace_id === data.targetWorkspaceId);
    }
    if (!allowed) throw new Error("That business isn't available to message.");

    const { data: conversationId, error } = await supabaseAdmin.rpc("find_or_create_workspace_conversation", {
      _sender_ws: data.senderWorkspaceId, _target_ws: data.targetWorkspaceId, _created_by: context.userId, _source: "network_profile",
    });
    if (error || !conversationId) throw new Error("Could not start that conversation.");
    return { ok: true as const, conversationId: conversationId as string };
  });

const listInput = z.object({ workspaceId: z.string().uuid(), includeArchived: z.boolean().optional() }).strict();

export const listConversations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => listInput.parse(i))
  .handler(async ({ data, context }): Promise<ConversationRow[]> => {
    await assertCanAccess(context, data.workspaceId);
    let q = context.supabase
      .from("workspace_conversations")
      .select("id, workspace_a_id, workspace_b_id, archived_at, last_message_at, is_test")
      .or(`workspace_a_id.eq.${data.workspaceId},workspace_b_id.eq.${data.workspaceId}`)
      .order("last_message_at", { ascending: false, nullsFirst: false });
    if (!data.includeArchived) q = q.is("archived_at", null);
    const { data: convos, error } = await q;
    if (error) throw new Error("Could not load conversations.");
    const rows = (convos ?? []) as any[];
    if (rows.length === 0) return [];

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const otherIds = Array.from(new Set(rows.map((c) => (c.workspace_a_id === data.workspaceId ? c.workspace_b_id : c.workspace_a_id))));
    const { data: others } = await supabaseAdmin.from("workspaces").select("id, display_name, mfn_id").in("id", otherIds);
    const otherMap = new Map((others ?? []).map((w: any) => [w.id, w]));

    const results: ConversationRow[] = [];
    for (const c of rows) {
      const otherId = c.workspace_a_id === data.workspaceId ? c.workspace_b_id : c.workspace_a_id;
      const other = otherMap.get(otherId);
      const { data: lastMsg } = await context.supabase
        .from("workspace_messages").select("body, created_at, sent_by_user_id").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: sender } = lastMsg ? await supabaseAdmin.from("user_profiles").select("display_name").eq("user_id", lastMsg.sent_by_user_id).maybeSingle() : { data: null };
      const { count } = await context.supabase
        .from("workspace_messages").select("id", { count: "exact", head: true })
        .eq("conversation_id", c.id).eq("recipient_workspace_id", data.workspaceId).is("read_at", null);
      results.push({
        id: c.id, otherWorkspaceId: otherId, otherName: other?.display_name ?? "Unknown business", otherMfnId: other?.mfn_id ?? null,
        lastSenderName: sender ? sender.display_name : null, lastMessage: lastMsg?.body ?? null, lastMessageAt: c.last_message_at, unreadCount: count ?? 0, archived: !!c.archived_at, isTest: !!c.is_test,
      });
    }
    return results;
  });

const convInput = z.object({ workspaceId: z.string().uuid(), conversationId: z.string().uuid() }).strict();

export const getConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => convInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context, data.workspaceId);
    const { data: convo } = await context.supabase
      .from("workspace_conversations").select("id, workspace_a_id, workspace_b_id, archived_at")
      .eq("id", data.conversationId).maybeSingle();
    if (!convo || (convo.workspace_a_id !== data.workspaceId && convo.workspace_b_id !== data.workspaceId)) {
      return { ok: false as const, error: "Conversation isn't available." };
    }
    const otherId = convo.workspace_a_id === data.workspaceId ? convo.workspace_b_id : convo.workspace_a_id;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: other }, { data: msgs }] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id, display_name, mfn_id").eq("id", otherId).maybeSingle(),
      context.supabase.from("workspace_messages").select("id, sender_workspace_id, recipient_workspace_id, sent_by_user_id, body, created_at, read_at")
        .eq("conversation_id", data.conversationId).order("created_at", { ascending: true }).limit(500),
    ]);
    const rows = (msgs ?? []) as any[];
    const senderUserIds = Array.from(new Set(rows.map((m) => m.sent_by_user_id)));
    const { data: profiles } = senderUserIds.length
      ? await supabaseAdmin.from("user_profiles").select("user_id, display_name").in("user_id", senderUserIds)
      : { data: [] as any[] };
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, (p.display_name ?? "").split(" ")[0] || null]));
    const messages: MessageRow[] = rows.map((m) => ({
      id: m.id, senderWorkspaceId: m.sender_workspace_id, recipientWorkspaceId: m.recipient_workspace_id,
      senderFirstName: nameMap.get(m.sent_by_user_id) ?? null, body: m.body, createdAt: m.created_at, readAt: m.read_at,
    }));
    return {
      ok: true as const,
      conversation: { id: convo.id, archived: !!convo.archived_at, otherWorkspaceId: otherId, otherName: other?.display_name ?? "Unknown business", otherMfnId: other?.mfn_id ?? null },
      messages,
    };
  });

const sendInput = z.object({ workspaceId: z.string().uuid(), conversationId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict();

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => sendInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convo } = await supabaseAdmin.from("workspace_conversations").select("id, workspace_a_id, workspace_b_id, archived_at").eq("id", data.conversationId).maybeSingle();
    if (!convo || (convo.workspace_a_id !== data.workspaceId && convo.workspace_b_id !== data.workspaceId)) throw new Error("Conversation isn't available.");
    if (convo.archived_at) throw new Error("This conversation is archived.");
    const recipientId = convo.workspace_a_id === data.workspaceId ? convo.workspace_b_id : convo.workspace_a_id;
    const { error } = await supabaseAdmin.from("workspace_messages").insert({
      conversation_id: data.conversationId, sender_workspace_id: data.workspaceId, recipient_workspace_id: recipientId,
      sent_by_user_id: context.userId, body: data.body,
    });
    if (error) throw new Error("Could not send that message.");
    return { ok: true };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => convInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("workspace_messages").update({ read_at: new Date().toISOString() })
      .eq("conversation_id", data.conversationId).eq("recipient_workspace_id", data.workspaceId).is("read_at", null);
    return { ok: true };
  });

const archiveInput = z.object({ workspaceId: z.string().uuid(), conversationId: z.string().uuid(), archived: z.boolean() }).strict();

export const archiveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => archiveInput.parse(i))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context, data.workspaceId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convo } = await supabaseAdmin.from("workspace_conversations").select("id, workspace_a_id, workspace_b_id").eq("id", data.conversationId).maybeSingle();
    if (!convo || (convo.workspace_a_id !== data.workspaceId && convo.workspace_b_id !== data.workspaceId)) throw new Error("Conversation isn't available.");
    const { error } = await supabaseAdmin.from("workspace_conversations").update({ archived_at: data.archived ? new Date().toISOString() : null }).eq("id", data.conversationId);
    if (error) throw new Error("Could not update that conversation.");
    return { ok: true };
  });

/** Total unread business-conversation messages across the caller's messaging
 *  workspaces — powers the static green dot on the Messaging nav item. */
export const getMessagingUnreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<number> => {
    const { data: memberships } = await context.supabase
      .from("workspace_members")
      .select("workspace_id, role, can_message_for_workspace, workspaces!inner(status)")
      .eq("user_id", context.userId);
    const wsIds = (memberships ?? [])
      .filter((r: any) => r.workspaces.status === "active" && (r.role === "owner" || r.role === "admin" || r.can_message_for_workspace))
      .map((r: any) => r.workspace_id as string);
    if (wsIds.length === 0) return 0;
    const { count } = await context.supabase
      .from("workspace_messages")
      .select("id", { count: "exact", head: true })
      .in("recipient_workspace_id", wsIds)
      .is("read_at", null);
    return count ?? 0;
  });

/* ---------------- Admin variants: admins read through RLS; manage requires messaging:manage ---------------- */

const adminConvInput = z.object({ conversationId: z.string().uuid() }).strict();

export const listAdminConversations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConversationRow[]> => {
    const { requireAdminCan } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "messaging", "read");
    const { data: convos, error } = await context.supabase
      .from("workspace_conversations").select("id, workspace_a_id, workspace_b_id, archived_at, last_message_at, is_test")
      .order("last_message_at", { ascending: false, nullsFirst: false }).limit(300);
    if (error) throw new Error("Could not load conversations.");
    const rows = (convos ?? []) as any[];
    if (rows.length === 0) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = Array.from(new Set(rows.flatMap((c) => [c.workspace_a_id, c.workspace_b_id])));
    const { data: wss } = await supabaseAdmin.from("workspaces").select("id, display_name, mfn_id").in("id", ids);
    const map = new Map((wss ?? []).map((w: any) => [w.id, w]));
    const results: ConversationRow[] = [];
    for (const c of rows) {
      const { data: lastMsg } = await context.supabase.from("workspace_messages").select("body, created_at, sent_by_user_id").eq("conversation_id", c.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const { data: sender } = lastMsg ? await supabaseAdmin.from("user_profiles").select("display_name").eq("user_id", lastMsg.sent_by_user_id).maybeSingle() : { data: null };
      const a = map.get(c.workspace_a_id); const b = map.get(c.workspace_b_id);
      results.push({
        id: c.id, otherWorkspaceId: c.workspace_b_id,
        otherName: `${a?.display_name ?? "Unknown"} ↔ ${b?.display_name ?? "Unknown"}`,
        otherMfnId: [a?.mfn_id, b?.mfn_id].filter(Boolean).join(" / ") || null,
        lastSenderName: sender ? sender.display_name : null, lastMessage: lastMsg?.body ?? null, lastMessageAt: c.last_message_at, unreadCount: 0, archived: !!c.archived_at, isTest: !!c.is_test,
      });
    }
    return results;
  });

export const getAdminConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => adminConvInput.parse(i))
  .handler(async ({ data, context }) => {
    const { requireAdminCan } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "messaging", "read");
    const { data: convo } = await context.supabase.from("workspace_conversations").select("id, workspace_a_id, workspace_b_id, archived_at").eq("id", data.conversationId).maybeSingle();
    if (!convo) return { ok: false as const, error: "Conversation isn't available." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: wss }, { data: msgs }] = await Promise.all([
      supabaseAdmin.from("workspaces").select("id, display_name, mfn_id").in("id", [convo.workspace_a_id, convo.workspace_b_id]),
      context.supabase.from("workspace_messages").select("id, sender_workspace_id, recipient_workspace_id, sent_by_user_id, body, created_at, read_at")
        .eq("conversation_id", data.conversationId).order("created_at", { ascending: true }).limit(500),
    ]);
    const map = new Map((wss ?? []).map((w: any) => [w.id, w]));
    const a = map.get(convo.workspace_a_id); const b = map.get(convo.workspace_b_id);
    const rows = (msgs ?? []) as any[];
    const senderUserIds = Array.from(new Set(rows.map((m) => m.sent_by_user_id)));
    const { data: profiles } = senderUserIds.length ? await supabaseAdmin.from("user_profiles").select("user_id, display_name").in("user_id", senderUserIds) : { data: [] as any[] };
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, (p.display_name ?? "").split(" ")[0] || null]));
    const messages: MessageRow[] = rows.map((m) => ({
      id: m.id, senderWorkspaceId: m.sender_workspace_id, recipientWorkspaceId: m.recipient_workspace_id,
      senderFirstName: nameMap.get(m.sent_by_user_id) ?? null, body: m.body, createdAt: m.created_at, readAt: m.read_at,
    }));
    return {
      ok: true as const,
      conversation: { id: convo.id, archived: !!convo.archived_at, otherWorkspaceId: convo.workspace_b_id, otherName: `${a?.display_name ?? "Unknown"} ↔ ${b?.display_name ?? "Unknown"}`, otherMfnId: null },
      messages,
    };
  });

export const adminArchiveConversation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversationId: z.string().uuid(), archived: z.boolean() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireAdminCan, adminCanAccount } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "messaging", "manage");
    const { data: convo } = await context.supabase.from("workspace_conversations").select("id, workspace_a_id, workspace_b_id").eq("id", data.conversationId).maybeSingle();
    if (!convo) throw new Error("Conversation isn't available.");
    if (!((await adminCanAccount(context, convo.workspace_a_id)) || (await adminCanAccount(context, convo.workspace_b_id)))) throw new Error("That conversation isn't in your scope.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workspace_conversations").update({ archived_at: data.archived ? new Date().toISOString() : null }).eq("id", data.conversationId);
    if (error) throw new Error("Could not update that conversation.");
    await context.supabase.rpc("log_staff_action", {
      _action: data.archived ? "workspace_conversation_archived" : "workspace_conversation_unarchived",
      _target_kind: "workspace_conversation", _target_id: data.conversationId, _metadata: {},
    });
    return { ok: true };
  });

export const adminSendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ conversationId: z.string().uuid(), senderWorkspaceId: z.string().uuid(), body: z.string().trim().min(1).max(2000) }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { requireAdminCan, adminCanAccount } = await import("@/lib/admin-guard.server");
    await requireAdminCan(context, "messaging", "manage");
    if (!(await adminCanAccount(context, data.senderWorkspaceId))) throw new Error("That workspace isn't in your scope.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: convo } = await supabaseAdmin.from("workspace_conversations").select("id, workspace_a_id, workspace_b_id, archived_at").eq("id", data.conversationId).maybeSingle();
    if (!convo || (convo.workspace_a_id !== data.senderWorkspaceId && convo.workspace_b_id !== data.senderWorkspaceId)) throw new Error("Conversation isn't available.");
    if (convo.archived_at) throw new Error("This conversation is archived.");
    const recipientId = convo.workspace_a_id === data.senderWorkspaceId ? convo.workspace_b_id : convo.workspace_a_id;
    const { error } = await supabaseAdmin.from("workspace_messages").insert({
      conversation_id: data.conversationId, sender_workspace_id: data.senderWorkspaceId, recipient_workspace_id: recipientId,
      sent_by_user_id: context.userId, body: data.body,
    });
    if (error) throw new Error("Could not send that message.");
    await context.supabase.rpc("log_staff_action", {
      _action: "workspace_message_sent", _target_kind: "workspace_conversation", _target_id: data.conversationId, _metadata: { sender_workspace_id: data.senderWorkspaceId },
    });
    return { ok: true };
  });

/* ---------------- Owner/admin: member messaging permission ---------------- */

const permInput = z.object({ workspaceId: z.string().uuid(), userId: z.string().uuid(), allowed: z.boolean() }).strict();

export const setMemberMessagingPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => permInput.parse(i))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("workspace_members").select("role").eq("workspace_id", data.workspaceId).eq("user_id", context.userId).maybeSingle();
    if (!me || (me.role !== "owner" && me.role !== "admin")) throw new Error("Only an owner or workspace admin can change this.");
    const { error } = await context.supabase.from("workspace_members").update({ can_message_for_workspace: data.allowed }).eq("workspace_id", data.workspaceId).eq("user_id", data.userId);
    if (error) throw new Error("Could not update that member's permission.");
    return { ok: true };
  });

export const listWorkspaceMembersForMessaging = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ workspaceId: z.string().uuid() }).strict().parse(i))
  .handler(async ({ data, context }) => {
    const { data: me } = await context.supabase.from("workspace_members").select("role").eq("workspace_id", data.workspaceId).eq("user_id", context.userId).maybeSingle();
    if (!me || (me.role !== "owner" && me.role !== "admin")) throw new Error("Only an owner or workspace admin can view this.");
    const { data: members, error } = await context.supabase.from("workspace_members").select("user_id, role, can_message_for_workspace").eq("workspace_id", data.workspaceId);
    if (error) throw new Error("Could not load members.");
    const ids = (members ?? []).map((m: any) => m.user_id);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = ids.length ? await supabaseAdmin.from("user_profiles").select("user_id, display_name").in("user_id", ids) : { data: [] as any[] };
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.user_id, p.display_name as string | null]));
    return (members ?? []).map((m: any) => ({ userId: m.user_id, role: m.role, name: nameMap.get(m.user_id) ?? "Member", canMessage: m.can_message_for_workspace }));
  });

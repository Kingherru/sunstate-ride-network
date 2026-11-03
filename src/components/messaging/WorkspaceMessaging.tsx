import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Send, Search } from "lucide-react";
import { DsButton } from "@/components/ds/controls";
import {
  listMyMessagingWorkspaces, listConversations, getConversation, sendMessage, markRead, archiveConversation,
  listAdminConversations, getAdminConversation, adminSendMessage, adminArchiveConversation,
  type ConversationRow, type MessageRow,
} from "@/lib/workspace-messages.functions";
import { usePortalPreview, previewBlocked } from "@/components/portal/preview-data";
import { previewConversations, PREVIEW_SELF_WORKSPACE } from "@/components/messaging/preview-conversations";

const NOTICE = "Safety: do not include diagnoses, unnecessary health details, payment credentials or sensitive documents in ordinary messages.";

type Props = {
  mode: "portal" | "admin";
  workspaceId?: string;
  readOnly?: boolean;
  initialConversationId?: string | null;
  onConversationChange?: (id: string | null) => void;
};

export function WorkspaceMessaging({ mode, workspaceId, readOnly, initialConversationId, onConversationChange }: Props) {
  const qc = useQueryClient();
  const listMine = useServerFn(listMyMessagingWorkspaces);
  const listMineConvos = useServerFn(listConversations);
  const getConvo = useServerFn(getConversation);
  const send = useServerFn(sendMessage);
  const markReadFn = useServerFn(markRead);
  const archiveFn = useServerFn(archiveConversation);
  const listAdminConvos = useServerFn(listAdminConversations);
  const getAdminConvo = useServerFn(getAdminConversation);
  const sendAdmin = useServerFn(adminSendMessage);
  const archiveAdmin = useServerFn(adminArchiveConversation);

  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<string | null>(initialConversationId ?? null);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const preview = usePortalPreview();
  const demo = preview.active ? previewConversations(preview.kind) : null;

  useEffect(() => { onConversationChange?.(selected); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const wsQuery = useQuery({
    queryKey: ["messaging-workspaces"],
    queryFn: () => listMine(),
    enabled: !demo && mode === "portal" && !workspaceId,
  });
  const effectiveWorkspaceId = demo ? PREVIEW_SELF_WORKSPACE : workspaceId ?? wsQuery.data?.[0]?.id ?? null;

  const convosQuery = useQuery({
    queryKey: ["workspace-conversations", mode, effectiveWorkspaceId, showArchived],
    queryFn: () => mode === "admin" ? listAdminConvos() : listMineConvos({ data: { workspaceId: effectiveWorkspaceId as string, includeArchived: showArchived } }),
    enabled: !demo && (mode === "admin" || !!effectiveWorkspaceId),
  });

  const conversations = useMemo(() => {
    const rows = (demo ? demo.map((d) => d.convo) : convosQuery.data ?? []) as ConversationRow[];
    const visible = showArchived || mode === "admin" ? rows : rows.filter((r) => !r.archived);
    return visible.filter((r) => [r.otherName, r.otherMfnId, r.lastSenderName, r.lastMessage].filter(Boolean).join(" ").toLowerCase().includes(search.trim().toLowerCase()));
  }, [convosQuery.data, showArchived, mode, search, demo]);

  // No auto-select: on phones the conversation list must show first, with a
  // clear Back to Conversations action after opening one.

  const threadQuery = useQuery({
    queryKey: ["workspace-conversation", mode, effectiveWorkspaceId, selected],
    queryFn: () => mode === "admin" ? getAdminConvo({ data: { conversationId: selected as string } }) : getConvo({ data: { workspaceId: effectiveWorkspaceId as string, conversationId: selected as string } }),
    enabled: !demo && !!selected && (mode === "admin" || !!effectiveWorkspaceId),
  });

  useEffect(() => {
    if (!demo && mode === "portal" && selected && effectiveWorkspaceId && threadQuery.data?.ok) {
      markReadFn({ data: { workspaceId: effectiveWorkspaceId, conversationId: selected } }).then(() => {
        qc.invalidateQueries({ queryKey: ["workspace-conversations", mode, effectiveWorkspaceId] });
      });
    }
  }, [selected, threadQuery.data, effectiveWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSend() {
    const body = draft.trim();
    if (!body || !selected || sending) return;
    if (demo) return previewBlocked();
    setSending(true); setSendError("");
    try {
      if (mode === "admin") {
        if (!effectiveWorkspaceId) throw new Error("Choose a workspace to send as.");
        await sendAdmin({ data: { conversationId: selected, senderWorkspaceId: effectiveWorkspaceId, body } });
      } else {
        await send({ data: { workspaceId: effectiveWorkspaceId as string, conversationId: selected, body } });
      }
      setDraft("");
      qc.invalidateQueries({ queryKey: ["workspace-conversation", mode, effectiveWorkspaceId, selected] });
      qc.invalidateQueries({ queryKey: ["workspace-conversations", mode, effectiveWorkspaceId] });
    } catch (e: any) {
      setSendError(e.message ?? "Could not send that message.");
    } finally { setSending(false); }
  }

  async function onToggleArchive(archived: boolean) {
    if (!selected) return;
    if (demo) return previewBlocked();
    try {
      if (mode === "admin") await archiveAdmin({ data: { conversationId: selected, archived } });
      else await archiveFn({ data: { workspaceId: effectiveWorkspaceId as string, conversationId: selected, archived } });
      qc.invalidateQueries({ queryKey: ["workspace-conversation", mode, effectiveWorkspaceId, selected] });
      qc.invalidateQueries({ queryKey: ["workspace-conversations", mode, effectiveWorkspaceId] });
      toast.success(archived ? "Conversation archived." : "Conversation restored.");
    } catch (e: any) {
      toast.error(e.message ?? "Could not update that conversation.");
    }
  }

  const demoThread = demo?.find((d) => d.convo.id === selected);
  const thread = demoThread ? { ok: true as const, conversation: demoThread.convo, messages: demoThread.messages } : threadQuery.data?.ok ? threadQuery.data : null;
  const canCompose = !readOnly && (mode === "portal" ? !thread?.conversation.archived : true);

  return (
    <div className="space-y-3">
    {demo && <p role="status" className="ds-label rounded-ds-sm ds-status-blue px-3 py-2 uppercase">Preview mode — demo data. Preview only — no information was saved or sent.</p>}
    <div className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)]">
      <div className={`min-w-0 space-y-2 md:ds-glass md:p-2 ${selected ? "hidden md:block" : ""}`}>
        <div className="flex items-center justify-between gap-2 rounded-ds-sm bg-ds-primary ds-glass-blue px-3 py-2">
          <h3 className="ds-label uppercase tracking-[0.06em] text-ds-on-primary">Conversations</h3>
          {mode === "portal" && (
            <label className="ds-support flex items-center gap-1.5">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> <span className="text-ds-on-primary">Archived</span>
            </label>
          )}
        </div>
        <div className="portal-search"><Search className="size-4" aria-hidden /><input aria-label="Search workspace conversations" placeholder="Search accounts, senders, messages…" value={search} onChange={(e) => setSearch(e.target.value)} className="portal-input w-full" /></div>
        <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-ds-sm border border-ds-border">
          {!demo && convosQuery.isLoading && <p className="ds-support p-3">Loading…</p>}
          {(wsQuery.isError || convosQuery.isError) && <p role="alert" className="ds-support p-3 text-ds-error">Conversations couldn't load. Please try again.</p>}
          {(demo || !convosQuery.isLoading) && conversations.length === 0 && <p className="ds-support p-3">{search ? "No conversations match your search." : "No conversations yet. Use Message provider in the Provider Network directory to start one."}</p>}
          {conversations.map((c) => (
            <DsButton variant="ghost" key={c.id} onClick={() => setSelected(c.id)}
              className={`block h-auto w-full border-b border-ds-border px-3 py-2.5 text-left last:border-b-0 ${selected === c.id ? "bg-ds-sky" : "hover:bg-ds-bg"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`ds-body truncate ${c.unreadCount > 0 ? "font-bold text-ds-primary" : "font-semibold"}`}>{c.otherName}</span>
                {c.lastMessageAt && <span className="ds-caption ml-auto shrink-0 text-ds-text-2">{new Date(c.lastMessageAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}</span>}
                {c.unreadCount > 0 && <span className="ds-support shrink-0 rounded-ds-sm bg-ds-error px-2 py-0.5 text-ds-on-action" aria-label={`${c.unreadCount} unread`}>{c.unreadCount}</span>}
              </div>
              {c.otherMfnId && <p className="ds-support font-mono">{c.otherMfnId}</p>}
              {c.lastMessage && <p className="ds-support mt-0.5 truncate text-ds-on-bg/70">{c.lastMessage}</p>}
              {c.archived && <p className="ds-support text-ds-on-bg/50">Archived</p>}
            </DsButton>
          ))}
        </div>
      </div>

      <div className={`min-w-0 rounded-ds-sm border border-ds-sky-border bg-ds-surface ${selected ? "" : "hidden md:block"}`}>
        {!selected && <div className="p-6 text-center"><p className="ds-subheading text-ds-primary">Select a conversation</p><p className="ds-support mt-1">Messages between your business and other Network providers appear here.</p></div>}
        {selected && !demo && threadQuery.isLoading && <p className="ds-support p-4">Loading…</p>}
        {selected && threadQuery.isError && <p role="alert" className="ds-support p-4 text-ds-error">This conversation couldn't load. Please try again.</p>}
        {selected && thread && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-ds-sky-border bg-ds-sky px-4 py-3">
              <div className="min-w-0">
                <button onClick={() => setSelected(null)} className="ds-support mb-1 inline-flex items-center gap-1 font-semibold uppercase text-ds-primary hover:underline md:hidden">
                  ← Back to conversations
                </button>
                <h3 className="ds-body truncate font-bold text-ds-primary">{thread.conversation.otherName}</h3>
                {thread.conversation.otherMfnId && <p className="ds-support font-mono">{thread.conversation.otherMfnId}</p>}
              </div>
              {!readOnly && (
                <button onClick={() => onToggleArchive(!thread.conversation.archived)}
                  className="ds-support inline-flex shrink-0 items-center gap-1.5 rounded-ds-sm border border-ds-border px-2.5 py-1.5 uppercase hover:bg-ds-bg">
                  {thread.conversation.archived ? <><ArchiveRestore className="size-3.5" /> Restore</> : <><Archive className="size-3.5" /> Archive</>}
                </button>
              )}
            </div>
            <div className="max-h-[22rem] min-h-[10rem] flex-1 space-y-3 overflow-y-auto border-y border-ds-border px-4 py-3">
              {thread.messages.length === 0 && <p className="ds-support">No messages yet.</p>}
              {thread.messages.map((m: MessageRow) => {
                const mine = mode === "portal" && m.senderWorkspaceId === effectiveWorkspaceId;
                return (
                  <div key={m.id} className={`max-w-[32rem] rounded-ds-sm px-3 py-2 ${mine ? "ml-auto bg-ds-sky" : "bg-ds-bg"}`}>
                    <p className="ds-support font-semibold">{m.senderFirstName ?? "Team member"}</p>
                    <p className="ds-body whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="ds-support mt-1 text-ds-on-bg/50">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            {canCompose && (
              <div className="border-t border-ds-border p-3">
                <p className="ds-support mb-2 rounded-ds-sm ds-status-yellow px-2 py-1 font-semibold">{NOTICE}</p>
                <label htmlFor="wm-reply" className="sr-only">Reply message</label>
                <div className="flex items-end gap-2">
                  <textarea id="wm-reply" value={draft} onChange={(e) => { setDraft(e.target.value.slice(0, 2000)); setSendError(""); }} maxLength={2000} rows={2}
                    placeholder="Write a reply…" aria-describedby={sendError ? "wm-err" : undefined} className="portal-input min-h-[3rem] flex-1 resize-y" />
                  <button onClick={onSend} disabled={!draft.trim() || sending} className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-ds-sm bg-ds-action px-4 font-semibold uppercase text-ds-on-action disabled:opacity-50">
                    <Send className="size-4" aria-hidden />{sending ? "Sending…" : "Send"}
                  </button>
                </div>
                {sendError && <p id="wm-err" role="alert" className="ds-support mt-1 text-ds-error">{sendError}</p>}
                <p className="ds-support mt-1 text-right text-ds-on-bg/50">{draft.length}/2000</p>
              </div>
            )}
            {readOnly && <p className="ds-support border-t border-ds-border bg-ds-surface-muted px-4 py-2 text-ds-text-2">Read-only access — replies are turned off for your role.</p>}
            {demo && <p className="ds-support border-t border-ds-border bg-ds-peach px-4 py-2">Demo conversation — preview only. Nothing is saved or sent.</p>}
            {thread.conversation.archived && mode === "portal" && !readOnly && (
              <p className="ds-support border-t border-ds-border px-4 py-2 text-ds-on-bg/60">This conversation is archived. Restore it to send a new message.</p>
            )}
          </div>
        )}
        {selected && !demo && threadQuery.data && !threadQuery.data.ok && <p className="ds-support p-4">{threadQuery.data.error}</p>}
      </div>
    </div>
    </div>
  );
}

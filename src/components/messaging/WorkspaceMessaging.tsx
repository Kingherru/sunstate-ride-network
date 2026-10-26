import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Send } from "lucide-react";
import {
  listMyMessagingWorkspaces, listConversations, getConversation, sendMessage, markRead, archiveConversation,
  listAdminConversations, getAdminConversation, adminSendMessage, adminArchiveConversation,
  type ConversationRow, type MessageRow,
} from "@/lib/workspace-messages.functions";

const NOTICE = "Do not include patient or protected health information in network introduction messages.";

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

  useEffect(() => { onConversationChange?.(selected); }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const wsQuery = useQuery({
    queryKey: ["messaging-workspaces"],
    queryFn: () => listMine(),
    enabled: mode === "portal" && !workspaceId,
  });
  const effectiveWorkspaceId = workspaceId ?? wsQuery.data?.[0]?.id ?? null;

  const convosQuery = useQuery({
    queryKey: ["workspace-conversations", mode, effectiveWorkspaceId, showArchived],
    queryFn: () => mode === "admin" ? listAdminConvos() : listMineConvos({ data: { workspaceId: effectiveWorkspaceId as string, includeArchived: showArchived } }),
    enabled: mode === "admin" || !!effectiveWorkspaceId,
  });

  const conversations = useMemo(() => {
    const rows = (convosQuery.data ?? []) as ConversationRow[];
    return showArchived || mode === "admin" ? rows : rows.filter((r) => !r.archived);
  }, [convosQuery.data, showArchived, mode]);

  // No auto-select: on phones the conversation list must show first, with a
  // clear Back to Conversations action after opening one.

  const threadQuery = useQuery({
    queryKey: ["workspace-conversation", mode, effectiveWorkspaceId, selected],
    queryFn: () => mode === "admin" ? getAdminConvo({ data: { conversationId: selected as string } }) : getConvo({ data: { workspaceId: effectiveWorkspaceId as string, conversationId: selected as string } }),
    enabled: !!selected && (mode === "admin" || !!effectiveWorkspaceId),
  });

  useEffect(() => {
    if (mode === "portal" && selected && effectiveWorkspaceId && threadQuery.data?.ok) {
      markReadFn({ data: { workspaceId: effectiveWorkspaceId, conversationId: selected } }).then(() => {
        qc.invalidateQueries({ queryKey: ["workspace-conversations", mode, effectiveWorkspaceId] });
      });
    }
  }, [selected, threadQuery.data, effectiveWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSend() {
    const body = draft.trim();
    if (!body || !selected) return;
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
      toast.error(e.message ?? "Could not send that message.");
    }
  }

  async function onToggleArchive(archived: boolean) {
    if (!selected) return;
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

  const thread = threadQuery.data?.ok ? threadQuery.data : null;
  const canCompose = !readOnly && (mode === "portal" ? !thread?.conversation.archived : true);

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className={`min-w-0 space-y-2 ${selected ? "hidden md:block" : ""}`}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="ds-support font-semibold uppercase tracking-[0.06em]">Conversations</h3>
          {mode === "portal" && (
            <label className="ds-support flex items-center gap-1.5">
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archived
            </label>
          )}
        </div>
        <div className="max-h-[28rem] space-y-1 overflow-y-auto rounded-ds-sm border border-ds-border">
          {convosQuery.isLoading && <p className="ds-support p-3">Loading…</p>}
          {(wsQuery.isError || convosQuery.isError) && <p role="alert" className="ds-support p-3 text-ds-error">Conversations couldn't load. Please try again.</p>}
          {!convosQuery.isLoading && conversations.length === 0 && <p className="ds-support p-3">No conversations yet.</p>}
          {conversations.map((c) => (
            <button key={c.id} onClick={() => setSelected(c.id)}
              className={`block w-full border-b border-ds-border px-3 py-2.5 text-left last:border-b-0 ${selected === c.id ? "bg-ds-primary-soft" : "hover:bg-ds-bg"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="ds-body truncate font-semibold">{c.otherName}</span>
                {c.unreadCount > 0 && <span className="ds-support shrink-0 rounded-full bg-ds-action px-2 py-0.5 text-ds-on-action">{c.unreadCount}</span>}
              </div>
              {c.otherMfnId && <p className="ds-support font-mono">{c.otherMfnId}</p>}
              {c.lastMessage && <p className="ds-support mt-0.5 truncate text-ds-on-bg/70">{c.lastMessage}</p>}
              {c.archived && <p className="ds-support text-ds-on-bg/50">Archived</p>}
            </button>
          ))}
        </div>
      </div>

      <div className={`min-w-0 rounded-ds-sm border border-ds-border ${selected ? "" : "hidden md:block"}`}>
        {!selected && <p className="ds-support p-4">Select a conversation to view messages.</p>}
        {selected && threadQuery.isLoading && <p className="ds-support p-4">Loading…</p>}
        {selected && threadQuery.isError && <p role="alert" className="ds-support p-4 text-ds-error">This conversation couldn't load. Please try again.</p>}
        {selected && thread && (
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-ds-border px-4 py-3">
              <div className="min-w-0">
                <button onClick={() => setSelected(null)} className="ds-support mb-1 inline-flex items-center gap-1 font-semibold uppercase text-ds-primary hover:underline md:hidden">
                  ← Back to conversations
                </button>
                <p className="ds-body truncate font-semibold">{thread.conversation.otherName}</p>
                {thread.conversation.otherMfnId && <p className="ds-support font-mono">{thread.conversation.otherMfnId}</p>}
              </div>
              {!readOnly && (
                <button onClick={() => onToggleArchive(!thread.conversation.archived)}
                  className="ds-support inline-flex shrink-0 items-center gap-1.5 rounded-ds-sm border border-ds-border px-2.5 py-1.5 uppercase hover:bg-ds-bg">
                  {thread.conversation.archived ? <><ArchiveRestore className="size-3.5" /> Restore</> : <><Archive className="size-3.5" /> Archive</>}
                </button>
              )}
            </div>
            <div className="max-h-[22rem] min-h-[10rem] flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {thread.messages.length === 0 && <p className="ds-support">No messages yet.</p>}
              {thread.messages.map((m: MessageRow) => {
                const mine = mode === "portal" && m.senderWorkspaceId === effectiveWorkspaceId;
                return (
                  <div key={m.id} className={`max-w-[32rem] rounded-ds-sm px-3 py-2 ${mine ? "ml-auto bg-ds-primary-soft" : "bg-ds-bg"}`}>
                    <p className="ds-support font-semibold">{m.senderFirstName ?? "Team member"}</p>
                    <p className="ds-body whitespace-pre-wrap break-words">{m.body}</p>
                    <p className="ds-support mt-1 text-ds-on-bg/50">{new Date(m.createdAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
            {canCompose && (
              <div className="border-t border-ds-border p-3">
                <p className="ds-support mb-2 text-ds-on-bg/70">{NOTICE}</p>
                <div className="flex items-end gap-2">
                  <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 2000))} maxLength={2000} rows={2}
                    placeholder="Write a message…" className="portal-input min-h-[3rem] flex-1 resize-y" />
                  <button onClick={onSend} disabled={!draft.trim()} className="inline-flex size-11 shrink-0 items-center justify-center rounded-ds-sm bg-ds-action text-ds-on-action disabled:opacity-50">
                    <Send className="size-4" />
                  </button>
                </div>
                <p className="ds-support mt-1 text-right text-ds-on-bg/50">{draft.length}/2000</p>
              </div>
            )}
            {thread.conversation.archived && mode === "portal" && !readOnly && (
              <p className="ds-support border-t border-ds-border px-4 py-2 text-ds-on-bg/60">This conversation is archived. Restore it to send a new message.</p>
            )}
          </div>
        )}
        {selected && threadQuery.data && !threadQuery.data.ok && <p className="ds-support p-4">{threadQuery.data.error}</p>}
      </div>
    </div>
  );
}

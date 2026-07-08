import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listThreads,
  getThreadMessages,
  sendMessage,
  startDirectThread,
  discoverContacts,
} from "@/lib/messages.functions";
import type { PortalKind } from "@/routes/_authenticated/dashboard";
import { useCapabilities } from "@/lib/permissions";

type Thread = {
  id: string;
  subject: string | null;
  last_message_at: string;
  unread_count: number;
  participants: { user_id: string; name: string; company: string | null; display_id: string | null }[];
  last_message: { body: string; created_at: string; sender_id: string } | null;
};

type Contact = { user_id: string; name: string; subtitle?: string; company?: string | null; display_id?: string | null };

export function MessagesPanel({ userId, portal }: { userId: string; portal: PortalKind }) {
  const qc = useQueryClient();
  const caps = useCapabilities();
  const listFn = useServerFn(listThreads);
  const msgsFn = useServerFn(getThreadMessages);
  const sendFn = useServerFn(sendMessage);
  const startFn = useServerFn(startDirectThread);
  const discoverFn = useServerFn(discoverContacts);

  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [directoryKind, setDirectoryKind] = useState<"staff" | "providers" | "my_providers">(
    portal === "patient" ? "my_providers" : caps.isOps ? "staff" : "staff"
  );
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");

  const threadsQ = useQuery({
    queryKey: ["msg-threads"],
    queryFn: async () => {
      const r = await listFn();
      if (!r.ok) throw new Error(r.error);
      return r.threads as Thread[];
    },
    refetchInterval: 30_000,
  });

  const messagesQ = useQuery({
    queryKey: ["msg-thread", activeThread],
    queryFn: async () => {
      if (!activeThread) return [] as any[];
      const r = await msgsFn({ data: { thread_id: activeThread } });
      if (!r.ok) throw new Error(r.error);
      return r.messages;
    },
    enabled: !!activeThread,
    refetchInterval: 15_000,
  });

  const send = useMutation({
    mutationFn: async () => {
      if (!activeThread) return;
      const r = await sendFn({ data: { thread_id: activeThread, body: draft } });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["msg-thread", activeThread] });
      qc.invalidateQueries({ queryKey: ["msg-threads"] });
    },
  });

  const contactsQ = useQuery({
    queryKey: ["msg-directory", directoryKind, search],
    queryFn: async () => {
      const r = await discoverFn({ data: { kind: directoryKind, search } });
      if (!r.ok) throw new Error((r as any).error ?? "Failed");
      return (r as any).contacts as Contact[];
    },
    enabled: composeOpen,
  });

  const startWith = useMutation({
    mutationFn: async (uid: string) => {
      const r = await startFn({ data: { recipient_user_id: uid } });
      if (!r.ok) throw new Error(r.error);
      return r.thread_id;
    },
    onSuccess: (tid) => {
      setComposeOpen(false);
      setActiveThread(tid);
      qc.invalidateQueries({ queryKey: ["msg-threads"] });
    },
    onError: (e: any) => alert(e?.message ?? "Unable to start conversation"),
  });

  const threads = threadsQ.data ?? [];
  const active = useMemo(() => threads.find((t) => t.id === activeThread) ?? null, [threads, activeThread]);
  const messages = messagesQ.data ?? [];

  const availableKinds = useMemo(() => {
    const opts: { key: typeof directoryKind; label: string }[] = [];
    opts.push({ key: "staff", label: "Staff & Dispatchers" });
    if (portal === "provider" || portal === "facility") opts.push({ key: "providers", label: "Provider Network" });
    if (portal === "patient") opts.push({ key: "my_providers", label: "My Providers" });
    return opts;
  }, [portal]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-4 min-h-[560px]">
      {/* Thread list */}
      <aside className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">Conversations</h3>
          <button
            onClick={() => setComposeOpen((v) => !v)}
            className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {composeOpen ? "Close" : "New message"}
          </button>
        </div>
        <ul className="max-h-[520px] overflow-y-auto divide-y divide-border">
          {threadsQ.isLoading && <li className="p-4 text-sm text-muted-foreground">Loading…</li>}
          {!threadsQ.isLoading && threads.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">No conversations yet. Click "New message" to start one.</li>
          )}
          {threads.map((t) => {
            const others = t.participants.map((p) => p.name).join(", ") || "Direct message";
            const isActive = t.id === activeThread;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setActiveThread(t.id)}
                  className={`w-full text-left p-3 hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{others}</span>
                    {t.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  {t.last_message && (
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{t.last_message.body}</p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {new Date(t.last_message_at).toLocaleString()}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Right pane */}
      <section className="rounded-lg border border-border bg-card flex flex-col">
        {composeOpen ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-sm mb-2">Start a new conversation</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {availableKinds.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => setDirectoryKind(k.key)}
                    className={`rounded-full border px-3 py-1 text-xs ${directoryKind === k.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or company…"
                className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
              />
              {directoryKind === "providers" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  This directory lists subscribed providers on the network. You can message any provider once both accounts have an active subscription.
                </p>
              )}
              {directoryKind === "my_providers" && (
                <p className="mt-2 text-xs text-muted-foreground">
                  These are transportation providers you've previously ridden with or booked through the platform.
                </p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto">
              {contactsQ.isLoading && <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
              {!contactsQ.isLoading && (contactsQ.data ?? []).length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">No contacts found.</p>
              )}
              <ul className="divide-y divide-border">
                {(contactsQ.data ?? []).map((c) => (
                  <li key={c.user_id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      {c.subtitle && <p className="text-xs text-muted-foreground truncate">{c.subtitle}</p>}
                    </div>
                    <button
                      onClick={() => startWith.mutate(c.user_id)}
                      disabled={startWith.isPending}
                      className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      Message
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : active ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-sm">
                {active.participants.map((p) => p.name).join(", ")}
              </h3>
              {active.participants[0]?.company && (
                <p className="text-xs text-muted-foreground">{active.participants[0].company}</p>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {messagesQ.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
              {messages.map((m: any) => {
                const mine = m.sender_id === userId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={`mt-1 text-[10px] opacity-70`}>{new Date(m.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (draft.trim()) send.mutate(); }}
              className="border-t border-border p-3 flex gap-2"
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a message…"
                className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={send.isPending || !draft.trim()}
                className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                Send
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-8 text-center">
            Select a conversation on the left, or start a new message.
          </div>
        )}
      </section>
    </div>
  );
}

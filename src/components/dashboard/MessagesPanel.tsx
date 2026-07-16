import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listThreads,
  getThreadMessages,
  sendMessage,
  startDirectThread,
  discoverContacts,
  openDispatchThread,
  openZoneManagerThread,
  submitFeedbackMessage,
  listDispatchZones,
  deleteMessage,
  deleteOrLeaveThread,
} from "@/lib/messages.functions";

import type { PortalKind } from "@/routes/_authenticated/dashboard";
import { useCapabilities } from "@/lib/permissions";

type Relationship =
  | "staff"
  | "dispatch"
  | "zone_manager"
  | "feedback_admin"
  | "provider_network"
  | "prior_trip"
  | "subscription"
  | "unknown";

type Thread = {
  id: string;
  subject: string | null;
  last_message_at: string;
  unread_count: number;
  kind: string;
  relationship: Relationship;
  relationship_label: string;
  participants: { user_id: string; name: string; company: string | null; display_id: string | null; city: string | null }[];
  last_message: { body: string; created_at: string; sender_id: string } | null;
};

type Contact = {
  user_id: string;
  name: string;
  subtitle?: string;
  company?: string | null;
  city?: string | null;
  display_id?: string | null;
  relationship_label?: string;
};

type SortKey = "name" | "company" | "city";
type ComposeKind = "dispatch" | "zone_manager" | "feedback" | "my_providers" | "providers" | "staff";

function relBadgeClass(rel: Relationship): string {
  if (rel === "staff" || rel === "dispatch") return "bg-blue-100 text-blue-800 border border-blue-200";
  if (rel === "zone_manager") return "bg-indigo-100 text-indigo-800 border border-indigo-200";
  if (rel === "feedback_admin") return "bg-rose-100 text-rose-800 border border-rose-200";
  if (rel === "provider_network") return "bg-amber-100 text-amber-900 border border-amber-200";
  if (rel === "prior_trip") return "bg-emerald-100 text-emerald-800 border border-emerald-200";
  if (rel === "subscription") return "bg-violet-100 text-violet-800 border border-violet-200";
  return "bg-secondary text-secondary-foreground border border-border";
}

export function MessagesPanel({ userId, portal }: { userId: string; portal: PortalKind }) {
  const qc = useQueryClient();
  const caps = useCapabilities();
  const listFn = useServerFn(listThreads);
  const msgsFn = useServerFn(getThreadMessages);
  const sendFn = useServerFn(sendMessage);
  const startFn = useServerFn(startDirectThread);
  const discoverFn = useServerFn(discoverContacts);
  const openDispatchFn = useServerFn(openDispatchThread);
  const openZoneFn = useServerFn(openZoneManagerThread);
  const submitFeedbackFn = useServerFn(submitFeedbackMessage);
  const zonesFn = useServerFn(listDispatchZones);

  const availableKinds = useMemo(() => {
    const opts: { key: ComposeKind; label: string }[] = [];
    opts.push({ key: "dispatch", label: "Dispatch" });
    if (portal === "provider" || portal === "facility") {
      opts.push({ key: "zone_manager", label: "Zone Manager" });
      opts.push({ key: "providers", label: "Provider Network" });
    }
    if (portal === "patient" || portal === "facility") opts.push({ key: "my_providers", label: "My Providers" });
    if (caps.isOps) opts.push({ key: "staff", label: "Staff" });
    opts.push({ key: "feedback", label: "Feedback → Admin" });
    return opts;
  }, [portal, caps.isOps]);

  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [composeKind, setComposeKind] = useState<ComposeKind>(availableKinds[0]?.key ?? "dispatch");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [threadSearch, setThreadSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [initialBody, setInitialBody] = useState("");
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [zoneId, setZoneId] = useState<string>("");

  const threadsQ = useQuery({
    queryKey: ["msg-threads"],
    queryFn: async () => {
      const r = await listFn();
      if (!r.ok) throw new Error(r.error);
      return { threads: r.threads as unknown as Thread[], total_unread: r.total_unread ?? 0 };
    },
    refetchInterval: 30_000,
  });

  const messagesQ = useQuery({
    queryKey: ["msg-thread", activeThread],
    queryFn: async () => {
      if (!activeThread) return [] as any[];
      const r = await msgsFn({ data: { thread_id: activeThread } });
      if (!r.ok) throw new Error(r.error);
      qc.invalidateQueries({ queryKey: ["msg-threads"] });
      qc.invalidateQueries({ queryKey: ["msg-unread-total"] });
      return r.messages;
    },
    enabled: !!activeThread,
    refetchInterval: 15_000,
  });

  // Realtime: any new message or new participant → refresh lists.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`messages-live-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        qc.invalidateQueries({ queryKey: ["msg-threads"] });
        if (payload?.new?.thread_id) {
          qc.invalidateQueries({ queryKey: ["msg-thread", payload.new.thread_id] });
        }
        qc.invalidateQueries({ queryKey: ["my-notifications"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "thread_participants" }, () => {
        qc.invalidateQueries({ queryKey: ["msg-threads"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => {
        qc.invalidateQueries({ queryKey: ["my-notifications"] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, qc]);

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
    queryKey: ["msg-directory", composeKind, search, sortKey],
    queryFn: async () => {
      const kind = composeKind === "providers" ? "providers"
        : composeKind === "my_providers" ? "my_providers"
        : "staff";
      const r = await discoverFn({ data: { kind, search, sort: sortKey } });
      if (!r.ok) throw new Error((r as any).error ?? "Failed");
      return (r as any).contacts as Contact[];
    },
    enabled: composeOpen && (composeKind === "providers" || composeKind === "my_providers" || composeKind === "staff"),
  });

  const zonesQ = useQuery({
    queryKey: ["dispatch-zones"],
    queryFn: async () => {
      const r = await zonesFn();
      return r.ok ? r.zones : [];
    },
    enabled: composeOpen && composeKind === "zone_manager",
  });

  const startWith = useMutation({
    mutationFn: async (uid: string) => {
      const r = await startFn({ data: { recipient_user_id: uid, initial_body: initialBody } });
      if (!r.ok) throw new Error(r.error);
      return r.thread_id;
    },
    onSuccess: (tid) => afterCompose(tid),
    onError: (e: any) => setComposeError(e?.message ?? "Unable to start conversation"),
  });

  const openDispatchM = useMutation({
    mutationFn: async () => {
      const r = await openDispatchFn({ data: { initial_body: initialBody } });
      if (!r.ok) throw new Error(r.error);
      return r.thread_id;
    },
    onSuccess: (tid) => afterCompose(tid),
    onError: (e: any) => setComposeError(e?.message ?? "Unable to reach Dispatch"),
  });

  const openZoneM = useMutation({
    mutationFn: async () => {
      if (!zoneId) throw new Error("Pick a zone");
      const r = await openZoneFn({ data: { zone_id: zoneId, initial_body: initialBody } });
      if (!r.ok) throw new Error(r.error);
      return r.thread_id;
    },
    onSuccess: (tid) => afterCompose(tid),
    onError: (e: any) => setComposeError(e?.message ?? "Unable to reach Zone Manager"),
  });

  const feedbackM = useMutation({
    mutationFn: async () => {
      const r = await submitFeedbackFn({ data: { subject: feedbackSubject, body: initialBody, category: feedbackCategory } });
      if (!r.ok) throw new Error(r.error);
      return r.thread_id;
    },
    onSuccess: (tid) => { setFeedbackSubject(""); afterCompose(tid); },
    onError: (e: any) => setComposeError(e?.message ?? "Unable to submit feedback"),
  });

  function afterCompose(tid: string) {
    setComposeError(null);
    setComposeOpen(false);
    setActiveThread(tid);
    setInitialBody("");
    qc.invalidateQueries({ queryKey: ["msg-threads"] });
  }

  const threads = threadsQ.data?.threads ?? [];
  const filteredThreads = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t) => {
      const hay = [
        ...t.participants.flatMap((p) => [p.name, p.company ?? "", p.city ?? ""]),
        t.last_message?.body ?? "",
        t.relationship_label,
        t.subject ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [threads, threadSearch]);
  const active = useMemo(() => threads.find((t) => t.id === activeThread) ?? null, [threads, activeThread]);
  const messages = messagesQ.data ?? [];

  const isDirectoryKind = composeKind === "providers" || composeKind === "my_providers" || composeKind === "staff";

  function threadTitle(t: Thread): string {
    if (t.kind === "dispatch") return "Dispatch";
    if (t.kind === "zone_manager") return t.subject ?? "Zone Manager";
    if (t.kind === "feedback_admin") return t.subject ?? "Feedback";
    return t.participants.map((p) => p.name).join(", ") || "Direct message";
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[340px,1fr] gap-4 min-h-[560px]">
      <aside className="rounded-lg border border-border bg-card flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm">
            Conversations
            {(threadsQ.data?.total_unread ?? 0) > 0 && (
              <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white align-middle">
                {threadsQ.data?.total_unread}
              </span>
            )}
          </h3>
          <button
            onClick={() => { setComposeError(null); setComposeOpen((v) => !v); }}
            className="rounded bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground hover:opacity-90"
          >
            {composeOpen ? "Close" : "New message"}
          </button>
        </div>
        <div className="p-2 border-b border-border">
          <input
            value={threadSearch}
            onChange={(e) => setThreadSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
          />
        </div>
        <ul className="flex-1 max-h-[520px] overflow-y-auto divide-y divide-border">
          {threadsQ.isLoading && <li className="p-4 text-sm text-muted-foreground">Loading…</li>}
          {!threadsQ.isLoading && filteredThreads.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground">
              {threadSearch ? "No conversations match your search." : "No conversations yet. Click \"New message\" to start one."}
            </li>
          )}
          {filteredThreads.map((t) => {
            const city = t.participants.find((p) => p.city)?.city;
            const isActive = t.id === activeThread;
            return (
              <li key={t.id}>
                <button
                  onClick={() => setActiveThread(t.id)}
                  className={`w-full text-left p-3 hover:bg-accent transition ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{threadTitle(t)}</span>
                    {t.unread_count > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                        {t.unread_count}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${relBadgeClass(t.relationship)}`}>
                      {t.relationship_label}
                    </span>
                    {city && <span className="text-[10px] text-muted-foreground">{city}</span>}
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

      <section className="rounded-lg border border-border bg-card flex flex-col">
        {composeOpen ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border">
              <h3 className="font-semibold text-sm mb-2">Start a new conversation</h3>
              <div className="flex flex-wrap gap-2 mb-2">
                {availableKinds.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => { setComposeKind(k.key); setComposeError(null); }}
                    className={`rounded-full border px-3 py-1 text-xs ${composeKind === k.key ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-accent"}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>

              {composeKind === "dispatch" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Message the Dispatch team. Admins are looped in until a dispatcher picks up.
                  </p>
                  <textarea
                    value={initialBody}
                    onChange={(e) => setInitialBody(e.target.value)}
                    placeholder="What do you need help with?"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm min-h-[80px]"
                  />
                  <button
                    onClick={() => openDispatchM.mutate()}
                    disabled={openDispatchM.isPending || !initialBody.trim()}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {openDispatchM.isPending ? "Opening…" : "Message Dispatch"}
                  </button>
                </div>
              )}

              {composeKind === "zone_manager" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Message your assigned Dispatch Zone Manager. If none is assigned yet, admins receive the message and the assigned manager will be added automatically once appointed.
                  </p>
                  <select
                    value={zoneId}
                    onChange={(e) => setZoneId(e.target.value)}
                    className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
                  >
                    <option value="">Select zone…</option>
                    {(zonesQ.data ?? []).map((z: any) => (
                      <option key={z.id} value={z.id}>{z.name}{z.code ? ` (${z.code})` : ""}</option>
                    ))}
                  </select>
                  <textarea
                    value={initialBody}
                    onChange={(e) => setInitialBody(e.target.value)}
                    placeholder="What's the coordination question?"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm min-h-[80px]"
                  />
                  <button
                    onClick={() => openZoneM.mutate()}
                    disabled={openZoneM.isPending || !initialBody.trim() || !zoneId}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {openZoneM.isPending ? "Opening…" : "Message Zone Manager"}
                  </button>
                </div>
              )}

              {composeKind === "feedback" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Send feedback straight to the platform admin. A live conversation is opened so you can follow up.
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={feedbackSubject}
                      onChange={(e) => setFeedbackSubject(e.target.value)}
                      placeholder="Subject"
                      className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                    <select
                      value={feedbackCategory}
                      onChange={(e) => setFeedbackCategory(e.target.value)}
                      className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="general">General</option>
                      <option value="bug">Bug</option>
                      <option value="feature">Feature request</option>
                      <option value="billing">Billing</option>
                      <option value="safety">Safety</option>
                    </select>
                  </div>
                  <textarea
                    value={initialBody}
                    onChange={(e) => setInitialBody(e.target.value)}
                    placeholder="Tell the admin team what's going on…"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm min-h-[100px]"
                  />
                  <button
                    onClick={() => feedbackM.mutate()}
                    disabled={feedbackM.isPending || !initialBody.trim() || !feedbackSubject.trim()}
                    className="rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                  >
                    {feedbackM.isPending ? "Sending…" : "Submit feedback"}
                  </button>
                </div>
              )}

              {isDirectoryKind && (
                <div className="mt-1 space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, company, or city…"
                      className="flex-1 rounded border border-border bg-background px-2.5 py-1.5 text-sm"
                    />
                    <select
                      value={sortKey}
                      onChange={(e) => setSortKey(e.target.value as SortKey)}
                      className="rounded border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      <option value="name">Sort: Name</option>
                      <option value="company">Sort: Company</option>
                      <option value="city">Sort: City</option>
                    </select>
                  </div>
                  <textarea
                    value={initialBody}
                    onChange={(e) => setInitialBody(e.target.value)}
                    placeholder="Optional first message…"
                    className="w-full rounded border border-border bg-background px-2.5 py-2 text-sm min-h-[60px]"
                  />
                  {composeKind === "providers" && (
                    <p className="text-xs text-muted-foreground">
                      Provider network — subscribed providers you can coordinate trips and referrals with.
                    </p>
                  )}
                  {composeKind === "my_providers" && (
                    <p className="text-xs text-muted-foreground">
                      Providers you have an active or previous trip relationship with.
                    </p>
                  )}
                </div>
              )}

              {composeError && (
                <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {composeError}
                </div>
              )}
            </div>

            {isDirectoryKind && (
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
                        <p className="text-xs text-muted-foreground truncate">
                          {[c.company, c.city, c.subtitle].filter(Boolean).join(" · ")}
                        </p>
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
            )}
          </div>
        ) : active ? (
          <div className="flex flex-col h-full">
            <div className="p-3 border-b border-border">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm">{threadTitle(active)}</h3>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${relBadgeClass(active.relationship)}`}>
                  {active.relationship_label}
                </span>
              </div>
              {(active.participants[0]?.company || active.participants[0]?.city) && (
                <p className="text-xs text-muted-foreground">
                  {[active.participants[0]?.company, active.participants[0]?.city].filter(Boolean).join(" · ")}
                </p>
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
                      <p className="mt-1 text-[10px] opacity-70">{new Date(m.created_at).toLocaleString()}</p>
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

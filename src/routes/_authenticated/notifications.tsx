import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Trash2, ArrowLeft, Inbox } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Filter = "all" | "unread" | "read";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — MyFloridaNemt" },
      { name: "description", content: "Browse your full notification history and mark items as read." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NotificationsPage,
});

function severityFor(type: string): "green" | "yellow" | "red" | "gray" {
  const t = type.toLowerCase();
  if (/(fail|error|denied|expired|urgent|reject|cancel)/.test(t)) return "red";
  if (/(pending|review|caution|reminder|attention|missing)/.test(t)) return "yellow";
  if (/(approved|complete|paid|success|assigned|booked|new)/.test(t)) return "green";
  return "gray";
}

function dotColor(sev: ReturnType<typeof severityFor>) {
  return sev === "green" ? "bg-emerald-500"
    : sev === "yellow" ? "bg-amber-500"
    : sev === "red" ? "bg-red-500"
    : "bg-muted-foreground";
}

function NotificationsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const listFn = useServerFn(listMyNotifications);
  const markFn = useServerFn(markNotificationsRead);
  const markAllFn = useServerFn(markAllNotificationsRead);
  const deleteFn = useServerFn(deleteNotification);

  const query = useQuery({
    queryKey: ["notifications", filter],
    queryFn: () => listFn({ data: { filter, limit: 200, offset: 0 } }),
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notifications-page-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [userId, qc]);

  const rows: NotificationRow[] = query.data?.rows ?? [];
  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (userId) qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
  };

  const markSelected = useMutation({
    mutationFn: (ids: string[]) => markFn({ data: { ids } }),
    onSuccess: () => { setSelected(new Set()); invalidateAll(); toast.success("Marked as read"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark read"),
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => { setSelected(new Set()); invalidateAll(); toast.success("All notifications marked as read"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark all read"),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { invalidateAll(); toast.success("Notification deleted"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onOpen = (n: NotificationRow) => {
    if (!n.read_at) markFn({ data: { ids: [n.id] } }).then(invalidateAll);
    if (n.link) {
      if (/^https?:/i.test(n.link)) window.location.href = n.link;
      else navigate({ to: n.link as any });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-1">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h1 className="text-2xl font-bold">Notifications</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-600 text-white">{unreadCount} unread</Badge>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {selected.size > 0 && (
              <Button size="sm" variant="secondary" onClick={() => markSelected.mutate(Array.from(selected))} disabled={markSelected.isPending}>
                <Check className="h-4 w-4 mr-1" /> Mark {selected.size} read
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending || unreadCount === 0}>
              <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
            </Button>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {query.isLoading ? "Loading…" : `${rows.length} notification${rows.length === 1 ? "" : "s"}`}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {rows.length === 0 && !query.isLoading ? (
              <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
                <Inbox className="h-8 w-8" />
                <p>No notifications to show.</p>
                <Link to="/dashboard" className="text-primary underline text-sm">Return to dashboard</Link>
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((n) => {
                  const sev = severityFor(n.type);
                  const isUnread = !n.read_at;
                  const isSelected = selected.has(n.id);
                  return (
                    <li
                      key={n.id}
                      className={`flex gap-3 p-4 hover:bg-muted/40 transition-colors ${isUnread ? "bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        aria-label="Select notification"
                        className="mt-1.5 h-4 w-4 accent-primary"
                        checked={isSelected}
                        onChange={() => toggleSelect(n.id)}
                      />
                      <span className={`mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor(sev)}`} aria-hidden />
                      <button
                        type="button"
                        onClick={() => onOpen(n)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-baseline gap-2">
                          <p className={`text-sm ${isUnread ? "font-semibold" : "font-medium"}`}>{n.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        {n.body && <p className="text-sm text-muted-foreground mt-0.5">{n.body}</p>}
                        <div className="mt-1 flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">{n.type}</Badge>
                          {isUnread && <span className="text-[10px] font-bold text-red-600 uppercase">New</span>}
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete notification"
                        onClick={() => removeOne.mutate(n.id)}
                        disabled={removeOne.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

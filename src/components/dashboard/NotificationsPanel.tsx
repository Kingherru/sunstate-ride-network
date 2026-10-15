import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { toast } from "sonner";
import { Bell, Check, CheckCheck, Trash2, Inbox, Search, Filter } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import {
  listMyNotifications,
  markNotificationsRead,
  markAllNotificationsRead,
  deleteNotification,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Filter = "all" | "unread" | "read";

function severityFor(type: string): "green" | "yellow" | "red" | "gray" {
  const t = (type ?? "").toLowerCase();
  if (/(fail|error|denied|expired|urgent|reject|cancel)/.test(t)) return "red";
  if (/(pending|review|caution|reminder|attention|missing)/.test(t)) return "yellow";
  if (/(approved|complete|paid|success|assigned|booked|new)/.test(t)) return "green";
  return "gray";
}

function dotColor(sev: ReturnType<typeof severityFor>) {
  return sev === "green"
    ? "bg-emerald-500"
    : sev === "yellow"
    ? "bg-amber-500"
    : sev === "red"
    ? "bg-red-500"
    : "bg-muted-foreground";
}

function categoryFor(type: string): string {
  const t = (type ?? "").toLowerCase();
  if (t.includes("trip") || t.includes("ride") || t.includes("reservation")) return "Trips";
  if (t.includes("payout") || t.includes("payment") || t.includes("invoice") || t.includes("charge")) return "Payments";
  if (t.includes("message") || t.includes("chat")) return "Messages";
  if (t.includes("compliance") || t.includes("document") || t.includes("credential") || t.includes("expire")) return "Compliance";
  if (t.includes("referral") || t.includes("offer")) return "Referrals";
  if (t.includes("member") || t.includes("subscription")) return "Membership";
  return "Other";
}

function groupLabel(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const diff = differenceInCalendarDays(new Date(), d);
  if (diff < 7) return "Earlier this week";
  if (diff < 30) return "Earlier this month";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "Earlier this week", "Earlier this month", "Older"];

export function NotificationsPanel() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
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
      .channel(`notifications-panel-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const rows: NotificationRow[] = query.data?.rows ?? [];
  const unreadCount = useMemo(() => rows.filter((r) => !r.read_at).length, [rows]);

  const categories = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => s.add(categoryFor(r.type)));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((n) => {
      if (category !== "all" && categoryFor(n.type) !== category) return false;
      if (!q) return true;
      return (
        n.title.toLowerCase().includes(q) ||
        (n.body ?? "").toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      );
    });
  }, [rows, category, search]);

  const grouped = useMemo(() => {
    const g = new Map<string, NotificationRow[]>();
    filtered.forEach((n) => {
      const k = groupLabel(n.created_at);
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(n);
    });
    return Array.from(g.entries()).sort(
      (a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]),
    );
  }, [filtered]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["notifications-bell-unread"] });
    if (userId) qc.invalidateQueries({ queryKey: ["unread-counts", userId] });
  };

  const markSelected = useMutation({
    mutationFn: (ids: string[]) => markFn({ data: { ids } }),
    onSuccess: () => {
      setSelected(new Set());
      invalidateAll();
      toast.success("Marked as read");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark read"),
  });

  const markAll = useMutation({
    mutationFn: () => markAllFn(),
    onSuccess: () => {
      setSelected(new Set());
      invalidateAll();
      toast.success("All notifications marked as read");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to mark all read"),
  });

  const removeOne = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      invalidateAll();
      toast.success("Notification deleted");
    },
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-xl font-bold tracking-tight">Notifications</h2>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white hover:bg-red-600">{unreadCount} unread</Badge>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {selected.size > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => markSelected.mutate(Array.from(selected))}
              disabled={markSelected.isPending}
            >
              <Check className="h-4 w-4 mr-1" /> Mark {selected.size} read
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending || unreadCount === 0}
          >
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        </div>
      </div>

      {/* Toolbar: search + filters */}
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search notifications…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-full md:w-[190px]">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["all", "unread", "read"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="rounded-md border border-border bg-card">
        <div className="px-4 py-3 border-b border-border text-xs font-mono uppercase tracking-wider text-muted-foreground">
          {query.isLoading
            ? "Loading…"
            : `${filtered.length} of ${rows.length} notification${rows.length === 1 ? "" : "s"}`}
        </div>

        {filtered.length === 0 && !query.isLoading ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Inbox className="h-8 w-8" />
            <p>No notifications match your filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {grouped.map(([label, items]) => (
              <section key={label}>
                <div className="sticky top-0 z-[1] bg-muted/60 backdrop-blur px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const sev = severityFor(n.type);
                    const isUnread = !n.read_at;
                    const isSelected = selected.has(n.id);
                    return (
                      <li
                        key={n.id}
                        className={`flex flex-wrap gap-3 p-4 hover:bg-muted/40 transition-colors ${
                          isUnread ? "bg-primary/5 border-l-4 border-l-primary" : "border-l-4 border-l-transparent"
                        }`}
                      >
                        <input
                          type="checkbox"
                          aria-label="Select notification"
                          className="mt-1.5 h-4 w-4 accent-primary flex-shrink-0"
                          checked={isSelected}
                          onChange={() => toggleSelect(n.id)}
                        />
                        <span
                          className={`mt-2 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotColor(sev)}`}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => onOpen(n)}
                          className="flex-1 min-w-0 text-left"
                        >
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <p
                              className={`text-sm break-words ${
                                isUnread ? "font-semibold text-foreground" : "font-medium text-foreground"
                              }`}
                            >
                              {n.title}
                            </p>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          {n.body && (
                            <p className="text-sm text-muted-foreground mt-0.5 break-words">
                              {n.body}
                            </p>
                          )}
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {categoryFor(n.type)}
                            </Badge>
                            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                              {n.type}
                            </span>
                            {isUnread && (
                              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wider">
                                New
                              </span>
                            )}
                            {n.link && (
                              <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                                Open →
                              </span>
                            )}
                          </div>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Delete notification"
                          onClick={() => removeOne.mutate(n.id)}
                          disabled={removeOne.isPending}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotificationsPanel;

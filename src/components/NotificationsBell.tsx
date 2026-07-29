import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { listMyNotifications, markNotificationRead } from "@/lib/requests.functions";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  ride_request_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationsBell() {
  const qc = useQueryClient();
  const list = useServerFn(listMyNotifications);
  const mark = useServerFn(markNotificationRead);
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["my-notifications"],
    queryFn: async () => {
      const r = await list();
      if (!r.ok) throw new Error(r.error);
      return r.rows as Notif[];
    },
    refetchInterval: 60_000,
  });

  const markM = useMutation({
    mutationFn: async (vars: { id?: string; all?: boolean }) => {
      const r = await mark({ data: vars });
      if (!r.ok) throw new Error(r.error);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-notifications"] }),
  });

  const rows = q.data ?? [];
  const unread = rows.filter((n) => !n.read_at).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative inline-flex items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        <span>Inbox</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-40 mt-2 w-96 max-w-[92vw] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-100 p-3">
            <h3 className="text-sm font-semibold text-zinc-900">Notifications</h3>
            {unread > 0 && (
              <button
                onClick={() => markM.mutate({ all: true })}
                className="text-xs text-[var(--brand-orange,#f47b20)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {q.isLoading && <li className="p-4 text-sm text-zinc-600">Loading…</li>}
            {!q.isLoading && rows.length === 0 && (
              <li className="p-4 text-sm text-zinc-600">No notifications yet.</li>
            )}
            {rows.map((n) => {
              const isUnread = !n.read_at;
              const inner = (
                <div
                  className={`flex items-start gap-2 p-3 transition ${
                    isUnread ? "bg-amber-50/60" : "bg-white"
                  } hover:bg-zinc-50`}
                >
                  <span
                    className={`mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full ${
                      isUnread ? "bg-[var(--brand-orange,#f47b20)]" : "bg-zinc-300"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{n.title}</p>
                    {n.body && <p className="mt-0.5 text-xs text-zinc-600">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wide text-zinc-600">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className="border-b border-zinc-100 last:border-b-0">
                  {n.ride_request_id ? (
                    <Link
                      to="/requests/$id"
                      params={{ id: n.ride_request_id }}
                      onClick={() => {
                        if (isUnread) markM.mutate({ id: n.id });
                        setOpen(false);
                      }}
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => {
                        if (isUnread) markM.mutate({ id: n.id });
                      }}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

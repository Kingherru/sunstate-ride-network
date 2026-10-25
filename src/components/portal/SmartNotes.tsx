import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Archive, ArchiveRestore, Plus, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";
import { cn } from "@/lib/utils";

type Note = { id: string; title: string; body: string; archived_at: string | null; updated_at: string };

/** Operational business notes, private to their creator inside one provider
 *  workspace. Stored server-side under row-level rules; never in the browser. */
export function SmartNotes({ workspaceId }: { workspaceId: string | null }) {
  const qc = useQueryClient();
  const [view, setView] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState<{ id: string | null; title: string; body: string } | null>(null);
  const key = ["smart-notes", workspaceId, view];

  const notes = usePortalQuery<Note[]>({
    queryKey: key,
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase.from("workspace_notes").select("id,title,body,archived_at,updated_at").eq("workspace_id", workspaceId!).order("updated_at", { ascending: false }).limit(50);
      q = view === "active" ? q.is("archived_at", null) : q.not("archived_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as Note[];
    },
  });

  const save = usePortalMutation({
    mutationFn: async (n: { id: string | null; title: string; body: string }) => {
      const row = { title: n.title.trim().slice(0, 120), body: n.body.slice(0, 4000) };
      const { error } = n.id
        ? await supabase.from("workspace_notes").update(row).eq("id", n.id)
        : await supabase.from("workspace_notes").insert({ ...row, workspace_id: workspaceId! });
      if (error) throw error;
    },
    onSuccess: () => { setEditing(null); toast.success("Note saved"); qc.invalidateQueries({ queryKey: ["smart-notes"] }); },
    onError: () => toast.error("Couldn't save the note. Please try again."),
  });

  const archive = usePortalMutation({
    mutationFn: async (n: { id: string; archive: boolean }) => {
      const { error } = await supabase.from("workspace_notes").update({ archived_at: n.archive ? new Date().toISOString() : null }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["smart-notes"] }),
    onError: () => toast.error("Couldn't update the note."),
  });

  const rows = (notes.data ?? []) as Note[];

  return (
    <section aria-labelledby="notes-h" className="rounded-ds border border-ds-border bg-ds-note shadow-[var(--ds-shadow)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ds-note-line px-4 py-3 sm:px-5">
        <h2 id="notes-h" className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><StickyNote className="size-4" aria-hidden />Smart notes</h2>
        <div className="flex items-center gap-1">
          {(["active", "archived"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={cn("ds-support rounded-ds-sm px-2.5 py-1 font-semibold uppercase", view === v ? "bg-ds-surface text-ds-primary" : "text-ds-text-2 hover:text-ds-primary")}>{v}</button>
          ))}
          {view === "active" && !editing && (
            <button type="button" onClick={() => setEditing({ id: null, title: "", body: "" })} disabled={!workspaceId}
              className="ds-support ml-1 inline-flex items-center gap-1 rounded-ds-sm px-2.5 py-1 font-semibold uppercase text-ds-action hover:bg-ds-surface"><Plus className="size-3.5" aria-hidden />New</button>
          )}
        </div>
      </div>
      <p className="ds-caption px-4 pt-3 text-ds-text-2 sm:px-5">Operational business notes, private to you. Don't enter health information, diagnoses or unnecessary patient details. Team sharing isn't available yet.</p>

      {editing && (
        <form className="space-y-3 px-4 py-3 sm:px-5" onSubmit={(e) => { e.preventDefault(); if (editing.title.trim() || editing.body.trim()) save.mutate(editing); }}>
          <div>
            <label htmlFor="note-title" className="portal-label">Title</label>
            <input id="note-title" className="portal-input" maxLength={120} value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
          </div>
          <div>
            <label htmlFor="note-body" className="portal-label">Note</label>
            <textarea id="note-body" className="portal-input min-h-28" maxLength={4000} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="portal-btn-primary" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</button>
            <button type="button" className="portal-btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}

      <ul className="divide-y divide-ds-note-line px-4 pb-3 sm:px-5">
        {!workspaceId && <li className="ds-support py-3 text-ds-text-2">Notes are available once your provider account is set up.</li>}
        {workspaceId && notes.isLoading && <li className="ds-support py-3" role="status">Loading notes…</li>}
        {workspaceId && !notes.isLoading && rows.length === 0 && <li className="ds-support py-3 text-ds-text-2">{view === "active" ? "No notes yet." : "No archived notes."}</li>}
        {rows.map((n) => (
          <li key={n.id} className="flex items-start justify-between gap-3 py-3">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => view === "active" && setEditing({ id: n.id, title: n.title, body: n.body })}>
              <span className="ds-body block truncate font-semibold text-ds-text">{n.title || "Untitled note"}</span>
              <span className="ds-support line-clamp-2 text-ds-text-2">{n.body}</span>
            </button>
            <button type="button" aria-label={view === "active" ? "Archive note" : "Restore note"} title={view === "active" ? "Archive" : "Restore"}
              onClick={() => archive.mutate({ id: n.id, archive: view === "active" })}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-ds-sm text-ds-text-2 hover:bg-ds-surface hover:text-ds-primary">
              {view === "active" ? <Archive className="size-4" aria-hidden /> : <ArchiveRestore className="size-4" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

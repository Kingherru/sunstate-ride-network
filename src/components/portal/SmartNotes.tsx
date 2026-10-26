import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Archive, ArchiveRestore, ArrowLeft, CarFront, Plus, StickyNote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { saveTripDraft } from "@/lib/trip-drafts.functions";
import { usePortalMutation, usePortalQuery } from "@/components/portal/preview-data";
import { cn } from "@/lib/utils";
import { DsButton } from "@/components/ds/controls";
import { usePortalPreview, previewBlocked } from "@/components/portal/preview-data";

type Note = { id: string; title: string; body: string; archived_at: string | null; updated_at: string };

/** Digital sticky notes: click + for a blank pale-yellow note, click inside
 *  to type, save with one action. Private to the creator inside one provider
 *  workspace, stored server-side under row-level rules; never in the browser. */
export function SmartNotes({ workspaceId }: { workspaceId: string | null }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const saveDraftFn = useServerFn(saveTripDraft);
  const preview = usePortalPreview();
  const [view, setView] = useState<"active" | "archived">("active");
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState("");
  const [creating, setCreating] = useState(false);
  const key = ["smart-notes", workspaceId, view];

  const notes = usePortalQuery<Note[]>({
    queryKey: key,
    enabled: !!workspaceId,
    queryFn: async () => {
      if (!workspaceId) return [];
      let q = supabase.from("workspace_notes").select("id,title,body,archived_at,updated_at").eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(50);
      q = view === "active" ? q.is("archived_at", null) : q.not("archived_at", "is", null);
      const { data, error } = await q;
      if (error) throw error;
      return data as Note[];
    },
  });

  const rows = (notes.data ?? []) as Note[];
  const openNote = rows.find((n) => n.id === openId) ?? null;
  const editing = creating || openNote !== null;

  const save = usePortalMutation({
    mutationFn: async (n: { id: string | null; body: string }) => {
      if (!workspaceId) throw new Error("Account not available");
      const body = n.body.slice(0, 4000);
      // First line doubles as the list label; no separate title field.
      const title = body.split("\n").map((l) => l.trim()).find(Boolean)?.slice(0, 120) ?? "";
      const { error } = n.id
        ? await supabase.from("workspace_notes").update({ title, body }).eq("id", n.id)
        : await supabase.from("workspace_notes").insert({ title, body, workspace_id: workspaceId });
      if (error) throw error;
    },
    onSuccess: () => { closeEditor(); toast.success("Note saved"); qc.invalidateQueries({ queryKey: ["smart-notes"] }); },
    onError: () => toast.error("Couldn't save the note. Please try again."),
  });

  const archive = usePortalMutation({
    mutationFn: async (n: { id: string; archive: boolean }) => {
      const { error } = await supabase.from("workspace_notes").update({ archived_at: n.archive ? new Date().toISOString() : null }).eq("id", n.id);
      if (error) throw error;
    },
    onSuccess: () => { closeEditor(); qc.invalidateQueries({ queryKey: ["smart-notes"] }); },
    onError: () => toast.error("Couldn't update the note."),
  });

  function closeEditor() { setCreating(false); setOpenId(null); setDraftBody(""); }
  function openEditor(n: Note | null) {
    setCreating(n === null);
    setOpenId(n?.id ?? null);
    setDraftBody(n?.body ?? "");
  }

  /** Creates a secure trip-request draft carrying only the note text into
   *  Special instructions — nothing is guessed or auto-submitted. The draft
   *  form opens so the user reviews and completes every field. */
  async function createTripFromNote() {
    if (preview.active) { previewBlocked(); return; }
    const body = draftBody.trim();
    if (!body) return;
    try {
      const { id } = await saveDraftFn({ data: { payload: { specialInstructions: body }, autosaved: false } });
      closeEditor();
      navigate({ to: "/portal/requests/new", search: { draft: id } });
    } catch {
      toast.error("Couldn't start a trip draft from that note.");
    }
  }

  const listPanel = (
    <div className="min-w-0">
      <div className="flex items-center gap-1 px-4 pt-3 sm:px-5" role="tablist" aria-label="Note views">
        {(["active", "archived"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => { setView(v); closeEditor(); }}
            className={cn("ds-support rounded-ds-sm px-2.5 py-1 font-semibold uppercase", view === v ? "bg-ds-surface text-ds-primary" : "text-ds-text-2 hover:text-ds-primary")}>
            {v === "active" ? "Saved notes" : "Archived"}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-[color:var(--ds-note-line)] px-4 pb-3 sm:px-5">
        {!workspaceId && <li className="ds-support py-3 text-ds-text-2">Notes are available once your provider account is set up.</li>}
        {workspaceId && notes.isLoading && <li className="ds-support py-3" role="status">Loading notes…</li>}
        {workspaceId && !notes.isLoading && rows.length === 0 && <li className="ds-support py-3 text-ds-text-2">{view === "active" ? "No notes yet. Tap + to start one." : "No archived notes."}</li>}
        {rows.map((n) => (
          <li key={n.id}>
            <button type="button" className="block w-full py-3 text-left" onClick={() => openEditor(n)}>
              <span className="ds-body block truncate font-semibold text-ds-text">{n.title || "Untitled note"}</span>
              <span className="ds-support line-clamp-2 text-ds-text-2">{n.body}</span>
              <span className="ds-caption mt-0.5 block">{new Date(n.updated_at).toLocaleString()}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const editorPanel = (
    <div className="px-4 py-3 sm:px-5">
      <DsButton type="button" variant="ghost" size="sm" onClick={closeEditor} className="mb-2">
        <ArrowLeft className="size-4" aria-hidden /> Back to notes
      </DsButton>
      <p className="ds-body font-semibold uppercase text-ds-primary">Write quick notes or create trips with note shortcodes</p>
      <p className="ds-support mt-1 font-semibold text-ds-text">Type in the note → Save → Create trip from note</p>
      <p className="ds-caption mt-0.5 mb-3 text-ds-text-2">Your note becomes Special instructions in a draft you review. Don't enter health information or diagnoses.</p>


      <label htmlFor="note-body" className="sr-only">Note text</label>
      <textarea
        id="note-body"
        autoFocus
        className="min-h-56 w-full resize-y rounded-ds-sm border border-[color:var(--ds-note-line)] bg-[color:var(--ds-note)] p-4 ds-body text-ds-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus"
        placeholder="Type your note here..."
        maxLength={4000}
        value={draftBody}
        onChange={(e) => setDraftBody(e.target.value)}
      />
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <DsButton type="button" size="sm" variant="secondary" disabled={save.isPending || !draftBody.trim()}
          onClick={() => save.mutate({ id: openNote?.id ?? null, body: draftBody })}>
          {save.isPending ? "Saving…" : "Save"}
        </DsButton>
        <DsButton type="button" size="sm" variant="ghost" onClick={closeEditor}>Cancel</DsButton>
        {view === "active" && (
          <DsButton type="button" size="sm" variant="ghost" className="col-span-2" disabled={!draftBody.trim()}
            onClick={createTripFromNote} title="Opens a trip draft with this note in Special instructions — nothing is submitted automatically">
            <CarFront className="size-4" aria-hidden /> Create trip from note
          </DsButton>
        )}
        {openNote && (
          <DsButton type="button" size="sm" variant="ghost" className="col-span-2" disabled={archive.isPending}
            onClick={() => archive.mutate({ id: openNote.id, archive: view === "active" })}>
            {view === "active" ? <><Archive className="size-4" aria-hidden /> Archive</> : <><ArchiveRestore className="size-4" aria-hidden /> Restore</>}
          </DsButton>
        )}
      </div>
    </div>
  );

  return (
    <section aria-labelledby="notes-h" className="rounded-ds ds-notepad border border-[color:var(--ds-note-line)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--ds-note-line)] px-4 py-3 sm:px-5">
        <h2 id="notes-h" className="ds-subheading flex items-center gap-2 uppercase text-ds-primary"><StickyNote className="size-4" aria-hidden />Smart notes</h2>
        {view === "active" && !editing && (
          <button type="button" onClick={() => openEditor(null)} disabled={!workspaceId} aria-label="New note"
            className="inline-flex size-9 items-center justify-center rounded-ds-sm bg-ds-surface text-ds-action hover:bg-ds-hover">
            <Plus className="size-5" aria-hidden />
          </button>
        )}
      </div>
      {editing ? editorPanel : listPanel}
    </section>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listMyCredentials, saveCredential, deleteCredential, myCredentialStatus,
} from "@/lib/medicaid.functions";

const KIND_OPTIONS = [
  { value: "general_liability", label: "General Liability Insurance" },
  { value: "auto_insurance", label: "Auto/Commercial Insurance" },
  { value: "workers_comp", label: "Workers' Compensation" },
  { value: "business_license", label: "Business License" },
  { value: "background_check", label: "Background Check" },
  { value: "drug_screening", label: "Drug Screening" },
  { value: "first_aid_cpr", label: "First Aid / CPR" },
  { value: "hipaa_training", label: "HIPAA Training" },
  { value: "other", label: "Other" },
];

function daysUntil(d?: string | null): number | null {
  if (!d) return null;
  const diff = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  return diff;
}

function badgeFor(days: number | null) {
  if (days === null) return { cls: "bg-muted text-muted-foreground", label: "No expiry" };
  if (days < 0) return { cls: "bg-red-100 text-red-700", label: "Expired" };
  if (days <= 30) return { cls: "bg-orange-100 text-orange-700", label: `Expires in ${days}d` };
  return { cls: "bg-accent/15 text-accent", label: `${days}d left` };
}

export function ProviderCredentialsPanel() {
  const qc = useQueryClient();
  const list = useServerFn(listMyCredentials);
  const save = useServerFn(saveCredential);
  const del = useServerFn(deleteCredential);
  const status = useServerFn(myCredentialStatus);

  const credsQ = useQuery({ queryKey: ["my-credentials"], queryFn: () => list() });
  const statusQ = useQuery({ queryKey: ["my-credential-status"], queryFn: () => status() });

  const [editing, setEditing] = useState<any | null>(null);
  const [uploading, setUploading] = useState(false);

  const saveMut = useMutation({
    mutationFn: (payload: any) => save({ data: payload }),
    onSuccess: () => {
      toast.success("Credential saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["my-credentials"] });
      qc.invalidateQueries({ queryKey: ["my-credential-status"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed to save"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-credentials"] });
      qc.invalidateQueries({ queryKey: ["my-credential-status"] });
    },
  });

  async function uploadDoc(file: File): Promise<string | null> {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
      const id = crypto.randomUUID();
      const path = `credentials/${new Date().toISOString().slice(0, 10)}/${id}.${ext}`;
      const { error } = await supabase.storage.from("provider-docs").upload(path, file, {
        contentType: file.type || undefined,
      });
      if (error) throw error;
      return path;
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
      return null;
    } finally { setUploading(false); }
  }

  const items = credsQ.data ?? [];
  const invalid = statusQ.data && !statusQ.data.valid;

  return (
    <div className="bg-card border border-border rounded-sm p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-extrabold tracking-tight">Credentials & Compliance</h3>
          <p className="text-xs text-muted-foreground">
            Dispatch is notified when a credential expires. Expired credentials block new trip assignments.
          </p>
        </div>
        <button className="portal-btn-primary px-3 py-2 text-sm"
          onClick={() => setEditing({ kind: "general_liability", label: "General Liability Insurance", required: true })}>
          + Add credential
        </button>
      </div>

      {invalid && (
        <div className="border border-red-300 bg-red-50 text-red-700 px-3 py-2 rounded-sm text-sm font-bold">
          One or more of your required credentials is expired — dispatch cannot assign new trips to you until it's renewed.
        </div>
      )}

      {editing && (
        <div className="border border-border rounded-sm p-4 grid grid-cols-2 gap-3 bg-background">
          <label className="block col-span-2">
            <span className="portal-label">Type</span>
            <select className="portal-input" value={editing.kind}
              onChange={(e) => {
                const kv = KIND_OPTIONS.find((k) => k.value === e.target.value);
                setEditing({ ...editing, kind: e.target.value, label: kv?.label ?? editing.label });
              }}>
              {KIND_OPTIONS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>
          <label className="block col-span-2">
            <span className="portal-label">Label</span>
            <input className="portal-input" value={editing.label ?? ""} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
          </label>
          <label className="block">
            <span className="portal-label">Expiration date</span>
            <input type="date" className="portal-input" value={editing.expires_at ?? ""} onChange={(e) => setEditing({ ...editing, expires_at: e.target.value })} />
          </label>
          <label className="block">
            <span className="portal-label">Required for dispatch?</span>
            <select className="portal-input" value={editing.required ? "yes" : "no"} onChange={(e) => setEditing({ ...editing, required: e.target.value === "yes" })}>
              <option value="yes">Yes — block trips if expired</option>
              <option value="no">No — informational only</option>
            </select>
          </label>
          <label className="block col-span-2">
            <span className="portal-label">Document</span>
            <input type="file" accept=".pdf,image/*" disabled={uploading}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const path = await uploadDoc(f);
                if (path) setEditing({ ...editing, doc_path: path });
              }} />
            {editing.doc_path && <div className="text-xs text-muted-foreground mt-1">Uploaded: {editing.doc_path.split("/").pop()}</div>}
          </label>
          <label className="block col-span-2">
            <span className="portal-label">Notes</span>
            <textarea className="portal-input" rows={2} value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          </label>
          <div className="col-span-2 flex gap-2">
            <button className="portal-btn-primary px-4 py-2 text-sm" disabled={saveMut.isPending}
              onClick={() => saveMut.mutate(editing)}>
              {saveMut.isPending ? "Saving…" : "Save"}
            </button>
            <button className="text-sm font-bold text-muted-foreground" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-border">
            <tr className="text-xs uppercase text-muted-foreground">
              <th className="py-2">Credential</th>
              <th>Expires</th>
              <th>Status</th>
              <th>Document</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">No credentials on file.</td></tr>
            )}
            {items.map((c: any) => {
              const days = daysUntil(c.expires_at);
              const b = badgeFor(days);
              return (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-2">
                    <div className="font-bold">{c.label}</div>
                    <div className="text-xs text-muted-foreground">{c.required ? "Required" : "Informational"}</div>
                  </td>
                  <td>{c.expires_at ?? "—"}</td>
                  <td><span className={`text-xs font-bold uppercase px-2 py-1 rounded-sm ${b.cls}`}>{b.label}</span></td>
                  <td>{c.doc_path ? <span className="text-xs">📎 attached</span> : <span className="text-xs text-muted-foreground">—</span>}</td>
                  <td className="text-right whitespace-nowrap">
                    <button className="text-xs font-bold text-accent hover:underline mr-3" onClick={() => setEditing(c)}>Edit</button>
                    <button className="text-xs font-bold text-red-600 hover:underline" onClick={() => confirm("Delete?") && delMut.mutate(c.id)}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

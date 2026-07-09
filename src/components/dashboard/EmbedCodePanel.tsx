import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { createEmbedToken, listEmbedTokens, revokeEmbedToken } from "@/lib/embed-tokens.functions";

export function EmbedCodePanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["embed-tokens"], queryFn: () => listEmbedTokens() });
  const create = useMutation({
    mutationFn: () => createEmbedToken(),
    onSuccess: () => { toast.success("New embed code generated"); qc.invalidateQueries({ queryKey: ["embed-tokens"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => revokeEmbedToken({ data: { id } }),
    onSuccess: () => { toast.success("Embed code revoked"); qc.invalidateQueries({ queryKey: ["embed-tokens"] }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const tokens = q.data ?? [];
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="bg-card border border-border rounded-sm p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-extrabold">Website embed code</h3>
          <p className="text-sm text-muted-foreground">
            Paste this snippet on your own website. Every ride request submitted through it is tagged to your account and routed to you first.
          </p>
        </div>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="bg-primary text-primary-foreground font-bold px-4 py-2 rounded-sm hover:bg-primary/90 disabled:opacity-50"
        >
          {create.isPending ? "Generating…" : "Generate new code"}
        </button>
      </div>

      {tokens.length === 0 && (
        <p className="text-sm text-muted-foreground">No embed code yet. Generate one to get started.</p>
      )}

      <div className="space-y-4">
        {tokens.map((t: any) => {
          const snippet = `<iframe src="${origin}/embed/request-a-ride/${t.token}" width="100%" height="900" style="border:0;max-width:720px" title="Request a Ride"></iframe>`;
          const revoked = !!t.revoked_at;
          return (
            <div key={t.id} className={`border rounded-sm p-4 ${revoked ? "bg-muted/40 border-border" : "bg-background border-border"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-muted-foreground">Token: {t.token}</span>
                {revoked ? (
                  <span className="text-xs font-bold uppercase text-destructive">Revoked</span>
                ) : (
                  <button
                    onClick={() => { if (confirm("Revoke this embed code? Websites using it will stop working.")) revoke.mutate(t.id); }}
                    className="text-xs font-bold text-destructive hover:underline"
                  >
                    Revoke
                  </button>
                )}
              </div>
              {!revoked && (
                <>
                  <textarea
                    readOnly
                    value={snippet}
                    className="w-full font-mono text-xs bg-muted/40 border border-border rounded-sm p-2 h-24"
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => { navigator.clipboard.writeText(snippet); toast.success("Copied to clipboard"); }}
                    className="mt-2 text-sm font-bold text-primary hover:underline"
                  >
                    Copy snippet
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

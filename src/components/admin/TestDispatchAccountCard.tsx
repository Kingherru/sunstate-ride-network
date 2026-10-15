import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getTestDispatchAccount,
  provisionTestDispatchAccount,
  deleteTestDispatchAccount,
} from "@/lib/admin-users.functions";

/**
 * Admin Portal card that provisions a Dispatcher test account so the full
 * dispatch workflow (auto-assign → manual reassign → provider reservations)
 * can be exercised end to end.
 */
export function TestDispatchAccountCard() {
  const qc = useQueryClient();
  const stateFn = useServerFn(getTestDispatchAccount);
  const provisionFn = useServerFn(provisionTestDispatchAccount);
  const deleteFn = useServerFn(deleteTestDispatchAccount);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  const q = useQuery({
    queryKey: ["admin", "test-dispatch-account"],
    queryFn: () => stateFn(),
  });

  const mProvision = useMutation({
    mutationFn: () => provisionFn(),
    onSuccess: (r: any) => {
      setCreds({ email: r.email, password: r.password });
      toast.success(r.created ? "Test dispatch account created" : "Password reset — new credentials below");
      qc.invalidateQueries({ queryKey: ["admin", "test-dispatch-account"] });
      qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not create the test dispatch account"),
  });

  const mDelete = useMutation({
    mutationFn: () => deleteFn(),
    onSuccess: () => {
      setCreds(null);
      toast.success("Test dispatch account removed");
      qc.invalidateQueries({ queryKey: ["admin", "test-dispatch-account"] });
      qc.invalidateQueries({ queryKey: ["admin", "non-patient-users"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Could not remove the account"),
  });

  const data: any = q.data;

  return (
    <div className="bg-card border border-border p-5 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">Test dispatch account</h2>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Creates a staff account with the <strong>Dispatcher</strong> role so you can sign in at{" "}
            <span className="font-mono">/staff/login</span> and test the full workflow: a new trip is
            auto-assigned to the nearest eligible provider, and dispatch can reassign it manually.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => mProvision.mutate()}
            disabled={mProvision.isPending}
            className="bg-primary text-primary-foreground text-sm font-bold px-4 py-2 disabled:opacity-60"
          >
            {mProvision.isPending
              ? "Working…"
              : data?.exists
                ? "Reset password"
                : "Create test dispatcher"}
          </button>
          {data?.exists && (
            <button
              onClick={() => mDelete.mutate()}
              disabled={mDelete.isPending}
              className="border border-border text-sm font-bold px-4 py-2 text-red-600"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {q.isLoading ? (
          "Checking…"
        ) : data?.exists ? (
          <>
            Account: <span className="font-mono">{data.email}</span> · roles:{" "}
            <span className="font-mono">{(data.roles ?? []).join(", ") || "none"}</span> · last sign-in:{" "}
            {data.last_sign_in_at ? new Date(data.last_sign_in_at).toLocaleString() : "never"}
          </>
        ) : (
          <>
            Not created yet. Will be created as <span className="font-mono">dispatch.test@myfloridanemt.com</span>.
          </>
        )}
      </div>

      {creds && (
        <div className="mt-4 border border-border bg-background p-4">
          <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-2">
            Credentials — shown once
          </div>
          <div className="font-mono text-sm">
            <div>{creds.email}</div>
            <div>{creds.password}</div>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(`${creds.email} / ${creds.password}`);
              toast.success("Copied");
            }}
            className="mt-3 text-xs font-bold text-primary hover:underline"
          >
            Copy credentials
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            Sign in at <span className="font-mono">/staff/login</span>, then open the Dispatch tab.
          </p>
        </div>
      )}
    </div>
  );
}

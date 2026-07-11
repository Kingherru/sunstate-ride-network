import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { startStaffThread } from "@/lib/workflow.functions";

interface Props {
  className?: string;
  label?: string;
  /** Where to send the user after the thread opens. Defaults to the dashboard messages tab. */
  redirectTo?: string;
}

/**
 * Opens (or reuses) a direct thread with an admin. Any signed-in user can
 * click this — the RPC round-robins to an available admin recipient.
 */
export function MessageStaffButton({ className, label = "Message Staff", redirectTo }: Props) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const fn = useServerFn(startStaffThread);
  const navigate = useNavigate();

  const m = useMutation({
    mutationFn: () => fn({ data: { initial_body: body } }),
    onSuccess: (r) => {
      if (!r.ok) {
        toast.error(r.error ?? "Couldn't reach staff right now.");
        return;
      }
      toast.success("Message sent to staff.");
      setOpen(false);
      setBody("");
      if (redirectTo) navigate({ to: redirectTo });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to send"),
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ??
          "bg-primary text-primary-foreground text-sm font-bold px-4 py-2 rounded-sm hover:opacity-90"
        }
      >
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold tracking-tight mb-2">Message Staff</h3>
            <p className="text-xs text-muted-foreground mb-3">
              An administrator will reply here. Please don't include sensitive payment details.
            </p>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="How can we help?"
              className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
              maxLength={5000}
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setOpen(false)}
                className="text-sm font-bold px-3 py-2 rounded-sm border border-border"
              >
                Cancel
              </button>
              <button
                onClick={() => m.mutate()}
                disabled={m.isPending || !body.trim()}
                className="text-sm font-bold px-4 py-2 rounded-sm bg-primary text-primary-foreground disabled:opacity-50"
              >
                {m.isPending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

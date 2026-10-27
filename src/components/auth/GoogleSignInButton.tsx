import { useState } from "react";
import { lovable } from "@/integrations/lovable";
import { safeReturnPath } from "@/lib/access.functions";
import { focusRing } from "@/components/home/buttons";
import { cn } from "@/lib/utils";

const POST_LOGIN_KEY = "mfn.auth.post-login";

/** Remembers the same-site path to return to after a full-page OAuth redirect. */
export function rememberPostLoginPath(path: string | null | undefined) {
  if (typeof window === "undefined") return;
  const safe = safeReturnPath(path);
  try {
    if (safe) sessionStorage.setItem(POST_LOGIN_KEY, safe);
    else sessionStorage.removeItem(POST_LOGIN_KEY);
  } catch {
    /* storage unavailable — the default destination applies */
  }
}

/** Reads and clears the stored return path. */
export function consumePostLoginPath(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = safeReturnPath(sessionStorage.getItem(POST_LOGIN_KEY));
    sessionStorage.removeItem(POST_LOGIN_KEY);
    return v;
  } catch {
    return null;
  }
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={cn("size-5 shrink-0", className)} aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * "Continue with Google" button using the Lovable-managed Google sign-in.
 * redirect_uri is always the site origin; the intended path is stored
 * separately and applied after the session is confirmed.
 */
export function GoogleSignInButton({ className, intendedPath, onError, onSignedIn, disabled }: {
  className?: string;
  intendedPath?: string | null;
  onError: (message: string) => void;
  onSignedIn: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    onError("");
    rememberPostLoginPath(intendedPath);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.redirected) return; // full-page flow: the browser leaves; the sign-in page completes routing on return
    setBusy(false);
    if (result.error) return onError(result.error.message || "Google sign-in didn't work. Please try again.");
    onSignedIn();
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy}
      className={cn(
        focusRing,
        "ds-button-text ds-transition inline-flex min-h-13 w-full items-center justify-center gap-3 whitespace-nowrap rounded-ds bg-ds-surface px-[1.8125rem] text-[1.0625rem] text-ds-primary shadow-[0_1px_3px_rgba(19,51,90,0.12)] hover:bg-ds-sky active:bg-ds-hover disabled:opacity-60",
        className,
      )}
    >
      {busy ? <span>CONNECTING TO GOOGLE…</span> : (<><GoogleG /> <span>CONTINUE WITH GOOGLE</span></>)}
    </button>
  );
}

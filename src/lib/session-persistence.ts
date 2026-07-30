/**
 * "Remember me" handling.
 *
 * The Supabase client persists the session in localStorage so a signed-in user
 * stays signed in across reloads. When the user does NOT tick "Remember me" we
 * treat the session as tab-scoped: a marker is written to sessionStorage (which
 * dies with the tab) and, on the next app boot without that marker, the stored
 * session is cleared before anything can auto-route the user into a portal.
 */
const REMEMBER_KEY = "mfn.auth.remember";
const TAB_KEY = "mfn.auth.tab-active";

export function setRememberPreference(remember: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REMEMBER_KEY, remember ? "true" : "false");
    sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    /* storage unavailable — fall back to default persistence */
  }
}

export function getRememberPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "false";
  } catch {
    return true;
  }
}

/** Clears a non-remembered session left over from a previous browser session. */
export async function enforceSessionPersistence() {
  if (typeof window === "undefined") return;
  let remembered = true;
  let sameTabSession = true;
  try {
    remembered = localStorage.getItem(REMEMBER_KEY) !== "false";
    sameTabSession = sessionStorage.getItem(TAB_KEY) === "1";
    if (remembered) sessionStorage.setItem(TAB_KEY, "1");
  } catch {
    return;
  }
  if (remembered || sameTabSession) return;

  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  if (data.session) await supabase.auth.signOut();
  try {
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

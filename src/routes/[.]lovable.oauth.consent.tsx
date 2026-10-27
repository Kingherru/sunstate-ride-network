import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type AuthorizationDetails = {
  client?: { name?: string; redirect_uri?: string } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
  scope?: string | null;
};

// The @supabase/supabase-js `auth.oauth` namespace is currently in beta and not
// covered by the shipped TS types. Wrap the three methods we need behind a
// narrow local type instead of grepping node_modules or calling raw endpoints.
type OAuthClient = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function oauthClient(): OAuthClient {
  return (supabase.auth as unknown as { oauth: OAuthClient }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  head: () => ({ meta: [{ title: "Connect an app — MY FLORIDA NEMT" }, { name: "description", content: "Approve or cancel an app connection to your MY FLORIDA NEMT account." }, { property: "og:title", content: "Connect an app — MY FLORIDA NEMT" }, { property: "og:description", content: "Approve or cancel an app connection." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" }] }),
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthClient().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data as AuthorizationDetails;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md rounded-ds bg-ds-sky border border-ds-sky-border p-6">
        <h1 className="text-lg font-extrabold mb-2">Authorization error</h1>
        <p className="text-sm text-ds-text-2">{String((error as Error)?.message ?? error)}</p>
      </div>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthClient().approveAuthorization(authorization_id)
      : await oauthClient().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";
  const scopes = (details?.scope ?? "").split(/\s+/).filter(Boolean);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 ">
      <div className="max-w-md w-full rounded-ds bg-ds-sky border border-ds-sky-border p-6 space-y-4">
        <div>
          <p className="font-mono text-xs font-bold text-ds-accent uppercase tracking-widest mb-1">Authorize</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Connect {clientName} to MY FLORIDA NEMT
          </h1>
          <p className="text-sm text-ds-text-2 mt-2">
            {clientName} will be able to call this app's enabled tools while you are signed in.
            This does not bypass this app's permissions or backend policies.
          </p>
        </div>
        {scopes.length > 0 && (
          <ul className="text-sm space-y-1 border-t border-ds-sky-border pt-3">
            {scopes.map((s: string) => (
              <li key={s} className="text-ds-text-2">
                {s === "openid" || s === "profile" ? "Share your basic profile"
                  : s === "email" ? "Share your email address"
                  : `Additional permission requested: ${s}`}
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="text-sm text-ds-error">{error}</p>}
        <div className="flex gap-2 pt-2">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 bg-ds-accent text-ds-on-accent font-bold px-4 py-2.5 rounded-ds-sm hover:bg-ds-accent-hover disabled:opacity-50"
          >
            {busy ? "Working…" : "Approve"}
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 bg-ds-primary text-ds-on-primary font-bold px-4 py-2.5 rounded-ds-sm hover:bg-ds-primary-hover disabled:opacity-50"
          >
            Cancel connection
          </button>
        </div>
      </div>
    </main>
  );
}

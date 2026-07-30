import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function loginForPath(_pathname: string): string {
  // Unified login: everyone signs in at /login and is routed to their portal.
  return "/login";
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: loginForPath(location.pathname) });
    }
    return { user: data.user };
  },
  component: () => <Outlet />,
});

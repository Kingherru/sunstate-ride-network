import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function loginForPath(pathname: string): string {
  if (pathname.startsWith("/patient")) return "/patient/login";
  if (pathname.startsWith("/provider")) return "/provider/login";
  if (pathname.startsWith("/facility")) return "/facility/login";
  return "/auth";
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

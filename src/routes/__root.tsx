import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { enforceSessionPersistence } from "@/lib/session-persistence";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { BrandName } from "@/components/brand/BrandName";
import { usesOwnShell } from "@/components/public/PublicPage";

function NotFoundComponent() {
  return (
    <div className="p-10 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <Link to="/" className="underline mt-4 inline-block">Home</Link>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="p-10 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <button className="underline mt-4" onClick={() => { router.invalidate(); reset(); }}>Try again</button>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "google-site-verification", content: "MjELbnAY45LuqbWT0GfTViGtbQjXgnPhWoYNhP7V0Bg" },
      { property: "og:site_name", content: "My Florida NEMT" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=Source+Sans+3:wght@400;600;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    void enforceSessionPersistence();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ownShell = usesOwnShell(pathname);
  return (
    <QueryClientProvider client={queryClient}>
      {ownShell ? (
        <Outlet />
      ) : (
        <div className="min-h-screen flex flex-col">
          <header className="border-b px-6 py-4 flex items-center justify-between">
            <Link to="/"><span className="theme-public"><BrandName /></span></Link>
            <nav className="flex gap-4 text-sm">
              <Link to="/shop">Training</Link>
              <Link to="/login">Sign in</Link>
            </nav>
          </header>
          <main className="flex-1 flex flex-col"><Outlet /></main>
        </div>
      )}
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

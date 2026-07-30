import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { PreviewRefreshButton } from "@/components/site/PreviewRefreshButton";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/ThemeProvider";

type PortalContext = "public" | "patient" | "provider" | "facility" | "admin";

function getPortalContext(path: string): PortalContext {
  if (path.startsWith("/patient")) return "patient";
  if (path.startsWith("/provider") && path !== "/providers") return "provider";
  if (path.startsWith("/facility")) return "facility";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/dashboard") || path.startsWith("/requests")) return "patient";
  return "public";
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs font-bold text-accent uppercase tracking-[0.2em] mb-4">Error 404</p>
        <h1 className="text-7xl font-extrabold tracking-tighter text-foreground">Off route.</h1>
        <p className="mt-4 text-sm text-muted">
          That page isn't on our dispatch board. Let's get you back on the road.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-sm bg-primary px-6 py-3 text-sm font-bold uppercase tracking-wide text-primary-foreground hover:bg-primary/90"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">Try again or head home.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-sm bg-primary px-4 py-2 text-sm font-bold uppercase text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a href="/" className="rounded-sm border border-input bg-background px-4 py-2 text-sm font-bold uppercase text-foreground hover:bg-accent/10">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#ffffff" },
      { name: "google-site-verification", content: "MjELbnAY45LuqbWT0GfTViGtbQjXgnPhWoYNhP7V0Bg" },
      { title: "My Florida NEMT — Statewide Medical Transportation" },
      {
        name: "description",
        content:
          "Medicaid non-emergency medical transportation across all 67 Florida counties — ambulatory, wheelchair, and stretcher rides.",
      },
      { property: "og:title", content: "My Florida NEMT — Statewide Medical Transportation" },
      { property: "og:description", content: "Medicaid NEMT across all 67 Florida counties — ambulatory, wheelchair, and stretcher rides." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "My Florida NEMT" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "My Florida NEMT — Statewide Medical Transportation" },
      { name: "twitter:description", content: "Medicaid NEMT across all 67 Florida counties — ambulatory, wheelchair, and stretcher rides." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7f0c8d69-b0e8-461e-b592-5b56d770711e/id-preview-cba6512f--5cb17cca-6c98-4dc3-adf4-9afbd3550794.lovable.app-1783724515308.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7f0c8d69-b0e8-461e-b592-5b56d770711e/id-preview-cba6512f--5cb17cca-6c98-4dc3-adf4-9afbd3550794.lovable.app-1783724515308.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;700&display=swap",
      },

    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "MedicalBusiness",
          name: "My Florida NEMT",
          description: "Statewide non-emergency medical transportation network serving Florida.",
          areaServed: "Florida, US",
          telephone: "+1-800-555-0199",
          email: "myfloridanemt@gmail.com",
          address: { "@type": "PostalAddress", addressRegion: "FL", addressCountry: "US" },
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  // Apply the cached admin theme synchronously before React hydrates so
  // colors don't flip from the CSS defaults to the DB theme on load.
  const themePreload = `try{var c=localStorage.getItem('mfn.theme.css.v1');if(c){var s=document.createElement('style');s.id='mfn-theme-preload';s.textContent=c;document.head.appendChild(s);}}catch(e){}`;
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themePreload }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const portal = getPortalContext(pathname);
  const isAuthedArea = portal !== "public";
  const isEmbed = pathname.startsWith("/embed/");
  const isLoginPage = ["/login", "/patient/login", "/provider/login", "/facility/login", "/staff/login", "/auth"].includes(pathname);
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          {!isAuthedArea && !isEmbed && !isLoginPage && <Header />}
          <main className="flex-1 flex flex-col">
            <Outlet />
          </main>
          {!isEmbed && !isLoginPage && <Footer portal={portal} />}
        </div>
        <Toaster richColors position="top-center" />
        <PreviewRefreshButton />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

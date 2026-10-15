import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated/learn")({ component: LearnLayout });

function LearnLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = pathname.startsWith("/learn/settings") ? "Settings" : "Training";
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-4 sm:px-6" style={{ background: "var(--ds-primary, #0b3d91)" }}>
        <h1 className="truncate text-sm font-semibold uppercase tracking-[0.04em] text-white">{title}</h1>
        <Link to="/learn/settings" aria-label="Settings" title="Settings"
          className="inline-flex size-10 items-center justify-center rounded-md text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>
      <Outlet />
    </div>
  );
}

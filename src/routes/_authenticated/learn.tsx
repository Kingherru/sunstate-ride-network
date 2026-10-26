import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { TrainingCartIcon } from '@/components/training/TrainingCart';

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({ meta: [{ title: 'Learning Center — MY FLORIDA NEMT' }, { name: 'description', content: 'Your private MY FLORIDA NEMT training and certificates.' }, { property: 'og:title', content: 'Learning Center — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Private training and certificates.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  component: LearnLayout,
});

function LearnLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = pathname.startsWith("/learn/settings") ? "Settings" : "Training";
  return (
    <div className="theme-portal min-h-screen bg-ds-bg">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-end gap-3 bg-ds-primary px-4 sm:px-6">
        <h1 className="sr-only">{title}</h1>
        <TrainingCartIcon />
        <Link to="/learn/settings" aria-label="Settings" title="Settings"
          className="inline-flex size-10 items-center justify-center rounded-ds-sm text-ds-on-primary hover:bg-ds-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-focus">
          <Settings className="size-5" aria-hidden />
        </Link>
      </header>
      <Outlet />
    </div>
  );
}

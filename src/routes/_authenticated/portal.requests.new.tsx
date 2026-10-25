import { createFileRoute } from "@tanstack/react-router";
import { RequestForm } from "@/components/requests/RequestForm";
import { getTripDraft } from '@/lib/trip-drafts.functions';

export const Route = createFileRoute("/_authenticated/portal/requests/new")({
  head: () => ({ meta: [{ title: "New Request — MY FLORIDA NEMT Portal" }, { name: 'description', content: 'Create or resume a secure transportation request.' }, { property: 'og:title', content: 'New Request — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Create or resume a secure transportation request.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: "robots", content: "noindex, nofollow" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ draft: typeof s.draft === 'string' ? s.draft : undefined }),
  loaderDeps: ({ search }) => ({ draft: search.draft }),
  loader: async ({ deps }) => deps.draft ? getTripDraft({ data: { draft_id: deps.draft } }) : null,
  component: NewRequest,
});
function NewRequest() {
  const draft = Route.useLoaderData();
  return <RequestForm key={draft?.id ?? 'new'} context="portal" initialDraft={draft ?? undefined} />;
}

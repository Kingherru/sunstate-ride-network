import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { getOnboarding } from '@/lib/onboarding.functions';
import { AccountOnboarding } from '@/components/onboarding/AccountOnboarding';

const setupQuery = queryOptions({ queryKey: ['account-onboarding'], queryFn: () => getOnboarding() });
export const Route = createFileRoute('/_authenticated/onboarding')({
  head: () => ({ meta: [{ title: 'Guided Account Setup — MY FLORIDA NEMT' }, { name: 'description', content: 'Complete your provider, patient or facility account information securely.' }, { property: 'og:title', content: 'Guided Account Setup — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Your resumable MY FLORIDA NEMT account setup.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex,nofollow' }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(setupQuery),
  component: Onboarding,
});
function Onboarding() {
  const { data } = useSuspenseQuery(setupQuery);
  return <main className="theme-portal min-h-screen bg-ds-bg px-4 py-6 sm:px-8 sm:py-10"><AccountOnboarding data={data} /></main>;
}
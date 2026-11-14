import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_authenticated/admin/training')({
  head: () => ({ meta: [{ title: 'Training Completion Records — MY FLORIDA NEMT' }, { name: 'description', content: 'Master Admin training certificate and completion records.' }, { property: 'og:title', content: 'Training Completion Records — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Protected training administration.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  beforeLoad:()=>{throw redirect({to:'/admin/settings',search:{section:'training'}});},
});
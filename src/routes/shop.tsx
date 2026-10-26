import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: 'Training Shop — MY FLORIDA NEMT' }, { name: 'description', content: 'Browse MY FLORIDA NEMT courses and certification tests.' }, { property: 'og:title', content: 'Training Shop — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Courses and certification tests for Florida NEMT.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: () => <Outlet />,
});

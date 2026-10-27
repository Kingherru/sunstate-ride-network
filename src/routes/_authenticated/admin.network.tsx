import { createFileRoute, redirect } from '@tanstack/react-router';

// Network activity now lives in Admin Messaging → Business Conversations.
export const Route = createFileRoute('/_authenticated/admin/network')({
  beforeLoad: () => { throw redirect({ to: '/admin/messaging', search: { tab: 'business' } }); },
});

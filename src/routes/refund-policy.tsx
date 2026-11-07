import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/refund-policy')({
  validateSearch: (search: Record<string, unknown>): { version?: string } => ({ version: typeof search.version === 'string' ? search.version : undefined }),
  beforeLoad:({search})=>{throw redirect({to:'/policies',search:{version:search.version},hash:'refunds',statusCode:301});},
});
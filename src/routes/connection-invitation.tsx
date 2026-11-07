import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { supabase } from '@/integrations/supabase/client';
import { resolveConnectionInvitation } from '@/lib/account-connections.functions';
import { DsButton } from '@/components/ds/controls';
export const Route = createFileRoute('/connection-invitation')({
  head: () => ({ meta: [{title:'Business Connection Invitation — MY FLORIDA NEMT'},{name:'description',content:'Review a private business connection invitation with your existing MY FLORIDA NEMT account.'},{property:'og:title',content:'Business Connection Invitation — MY FLORIDA NEMT'},{property:'og:description',content:'Sign in to confirm or decline a business connection.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}] }),
  component: Invitation,
});
function Invitation() {
  const resolve = useServerFn(resolveConnectionInvitation); const [notice,setNotice]=useState('Sign in with the invited business email to review this connection.'); const [loading,setLoading]=useState(true);
  useEffect(() => { const token=window.location.hash.slice(1); window.history.replaceState(null,'','/connection-invitation'); let live=true; void (async () => { const {data}=await supabase.auth.getUser(); if(data.user && /^[a-f0-9]{64}$/.test(token)) { try { const i=await resolve({data:{token}}); if(live)setNotice(`${i.inviterName} invited your ${i.intendedType} account. Reference ${i.reference}. Confirm or decline in Settings → Connections.`); } catch { if(live)setNotice('Invitation unavailable. Use your incoming invitations in Settings, or request a fresh link.'); } } if(live)setLoading(false); })(); return () => {live=false;}; },[resolve]);
  return <main className="theme-portal mx-auto min-h-screen max-w-2xl px-5 py-12"><h1 className="ds-page-title uppercase text-ds-primary">Business connection invitation</h1><p className="ds-body mt-5" role="status">{loading?'Checking invitation…':notice}</p><p className="ds-support mt-4">No workspace membership, patient records, trip access or financial authority is granted. Already have a business account? Use it rather than creating another.</p><div className="mt-6 flex flex-wrap gap-4"><Link to="/login" search={{redirect:'/portal/account?section=connections'}} className="ds-label text-ds-link underline">Sign in</Link><Link to="/create-account" search={{redirect:'/portal/account?section=connections'}} className="ds-label text-ds-link underline">Create account</Link><Link to="/portal/account" search={{section:'connections'}} className="ds-label text-ds-link underline">Review in Settings</Link></div></main>;
}
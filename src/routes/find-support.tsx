import {createFileRoute} from '@tanstack/react-router';
import {PageHero,pageHead} from '@/components/public/page-kit';
import {BusinessSearch} from '@/components/network/BusinessSearch';
import {listPublicBusinesses} from '@/lib/business-visibility.functions';
import {PublicPage} from '@/components/public/PublicPage';
export const Route=createFileRoute('/find-support')({head:()=>pageHead('/find-support','Find Transportation Support — MY FLORIDA NEMT','Search opted-in Florida transportation providers and facilities by business, location and services.','Find Transportation Support'),loader:()=>listPublicBusinesses(),component:FindSupport,errorComponent:()=> <main className="mfn-container py-12"><h1 className="ds-page-title uppercase">Business search unavailable</h1><p className="ds-body mt-4">Please try again later.</p></main>});
function FindSupport(){const rows=Route.useLoaderData();return <PublicPage><PageHero title="Find Transportation Support" intro="Florida providers and facilities"/><section className="mfn-container py-10"><BusinessSearch rows={rows} publicSite/></section></PublicPage>;}
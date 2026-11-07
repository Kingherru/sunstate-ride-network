import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { ArrowUpRight, BookOpen, Search } from 'lucide-react';
import { PublicPage } from '@/components/public/PublicPage';
import { PageHero, pageHead } from '@/components/public/page-kit';
import { DsInput, DsSelect } from '@/components/ds/controls';
import { RESOURCE_LIBRARY, RESOURCE_CATEGORIES, filterResources } from '@/lib/resource-library';
import {btnBlue as btnSecondary} from '@/components/home/buttons';
import { STARTUP_GUIDE } from '@/lib/digital-guide';
export const Route=createFileRoute('/resources/')({head:()=>pageHead('/resources','Resources — Florida & United States NEMT Guides | MY FLORIDA NEMT','Reviewed transportation guidance for patients, facilities and providers, plus educational business resources.','Resources','CollectionPage'),component:ResourcesPage});
function ResourcesPage(){
 const [query,setQuery]=useState('');const [category,setCategory]=useState('All');const [scope,setScope]=useState('All');
 const featured=RESOURCE_LIBRARY[3];const results=filterResources(query,category,scope);
 return <PublicPage><PageHero showCrumbs crumb="Resources" title="RESOURCES" intro={<p>Practical guidance for the people and businesses behind non-emergency transportation.</p>}/>
 <section className="mfn-section bg-ds-sky"><div className="mfn-container grid gap-10 lg:grid-cols-[2fr_1fr]">
 {featured&&<article><p className="ds-label text-ds-accent-active">FEATURED · {featured.scope} · {featured.category}</p><h2 className="ds-section-title mt-4 uppercase text-ds-primary">{featured.title}</h2><p className="ds-body-lg mt-4 max-w-2xl">{featured.description}</p><p className="ds-support mt-4">Reviewed {featured.reviewed} · About {featured.readingMinutes} min read</p><Link className={`${btnSecondary} mt-6`} to="/resources/$slug" params={{slug:featured.slug}}>Read resource<ArrowUpRight className="size-4"/></Link></article>}
 <aside className="space-y-4 border-l-0 lg:border-l lg:border-ds-border lg:pl-10"><BookOpen className="size-8 text-ds-accent-active"/><p className="ds-label">DIGITAL BUSINESS GUIDE · $50</p><h2 className="ds-subheading text-ds-primary">{STARTUP_GUIDE.title}</h2><p className="ds-body">{STARTUP_GUIDE.summary}</p><p className="ds-support">Educational guide, not certification. Purchase and delivery are not yet enabled.</p><Link className={btnSecondary} to="/shop/$slug" params={{slug:STARTUP_GUIDE.slug}}>View guide<ArrowUpRight className="size-4"/></Link></aside>
 </div></section>
 <section className="mfn-section bg-ds-bg"><div className="mfn-container"><h2 className="ds-section-title uppercase text-ds-primary">RESOURCE LIBRARY</h2>
 <div className="my-8 grid items-end gap-4 md:grid-cols-[2fr_1fr_1fr]"><label className="ds-label">Search resources<span className="relative mt-2 block"><Search className="absolute left-3 top-3 size-4 text-ds-text-2"/><DsInput className="pl-10" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search topics"/></span></label><label className="ds-label">Category<DsSelect className="mt-2" value={category} onChange={e=>setCategory(e.target.value)}><option value="All">All categories</option>{RESOURCE_CATEGORIES.map(c=><option key={c}>{c}</option>)}</DsSelect></label><label className="ds-label">Scope<DsSelect className="mt-2" value={scope} onChange={e=>setScope(e.target.value)}><option value="All">All scopes</option><option>Florida</option><option>United States</option></DsSelect></label></div>
 <p role="status" className="ds-support">{results.length} resources</p><ul className="mt-4 grid gap-x-10 gap-y-8 md:grid-cols-2">{results.map(r=><li key={r.slug} className="border-t border-ds-border py-6"><p className="ds-label text-ds-accent-active">{r.category} · {r.scope}</p><h3 className="ds-subheading mt-3 text-ds-primary"><Link to="/resources/$slug" params={{slug:r.slug}} className="hover:underline">{r.title}</Link></h3><p className="ds-body mt-3">{r.description}</p><p className="ds-support mt-4">Reviewed <time dateTime={r.reviewed}>{r.reviewed}</time> · About {r.readingMinutes} min read</p></li>)}</ul>{!results.length&&<p className="ds-body py-8">No reviewed resources match these filters.</p>}
 <div className="mt-10 flex flex-wrap gap-4"><Link className={btnSecondary} to="/training">View training</Link><Link className={btnSecondary} to="/create-account">Create account</Link></div></div></section></PublicPage>;
}

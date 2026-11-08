import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowLeftRight, ArrowRight, CalendarDays, CalendarPlus, ClipboardCheck, Clock3, FileText, Handshake, MapPin, Network, NotebookPen, ShieldCheck, Truck, UserPlus, Users, Wallet, type LucideIcon } from 'lucide-react';
import { PublicPage } from '@/components/public/PublicPage';
import { BrandName } from '@/components/brand/BrandName';
import { PageHero, Reveal, SectionHead, pageHead } from '@/components/public/page-kit';
import { buttonVariants } from '@/components/ui/button';
import { HOME_IMAGES } from '@/lib/site-config';

export const Route = createFileRoute('/why-my-florida-nemt')({
  head: () => pageHead('/why-my-florida-nemt', 'Why MY FLORIDA NEMT — One Network, Two Connections', 'Understand MY FLORIDA NEMT: patient and facility connections with independent providers, provider-to-provider coordination, and an estimated five-minute trip request path.', 'Why MY FLORIDA NEMT', 'AboutPage'),
  component: PlatformPage,
});

const patientBenefits: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: ClipboardCheck, title: 'One clear request', text: 'Enter transportation details in the shared trip form.' },
  { icon: Handshake, title: 'Your provider connections', text: 'Choose your usual provider when actively linked, or find another opted-in provider.' },
  { icon: CalendarDays, title: 'Safe trip tracking', text: 'Review your authorized trip status, timeline and history.' },
  { icon: Wallet, title: 'Clear invoice information', text: 'See provider-provided invoices and recorded payment status when available—not private business information.' },
  { icon: Users, title: 'Another connection when needed', text: 'Look for backup transportation without placing your trip in an uncontrolled statewide open pool.' },
];
const providerBenefits: typeof patientBenefits = [
  { icon: CalendarPlus, title: 'Owned trips and schedules', text: 'Organize your trips, schedules, vehicles, drivers, employees and contractors.' },
  { icon: NotebookPen, title: 'Smart Notes and shortcodes', text: 'Keep notes organized and prepare trip details with supported shortcodes.' },
  { icon: FileText, title: 'Your customer pricing', text: 'Manage provider-owned rate versions while preserving confirmed quote and invoice snapshots.' },
  { icon: ArrowLeftRight, title: 'Business-to-business connections', text: 'Connect and communicate with opted-in providers; prepare eligible referrals through separate Network controls.' },
  { icon: ShieldCheck, title: 'Separated business access', text: 'Keep workspace records separate. Team and contractor access depends on explicit authorization.' },
];
const steps: typeof patientBenefits = [
  { icon: Users, title: 'Choose your context', text: 'Patient/Personal, Facility or a Provider-owned trip.' },
  { icon: MapPin, title: 'Add the trip details', text: 'Pickup, destination, date/time, service and applicable return information.' },
  { icon: Handshake, title: 'Choose authorized contacts', text: 'Use linked patients, providers and payers when permitted, or enter required contact information.' },
  { icon: ClipboardCheck, title: 'Review before continuing', text: 'Check the request, applicable estimate or invoice information, and current policies.' },
  { icon: CalendarPlus, title: 'Submit or save', text: 'Submit for review or save your owned trip. Network sharing is a separate, explicit provider action.' },
];
function Benefits({ items }: { items: typeof patientBenefits }) {
  return <ul className="mt-6 space-y-5">{items.map(({ icon: Icon, title, text }) => <li key={title} className="flex min-w-0 gap-4"><Icon className="mt-1 size-6 shrink-0 text-ds-accent-active" aria-hidden /><div className="min-w-0"><h3 className="ds-subheading text-ds-primary">{title}</h3><p className="ds-body mt-1 text-ds-text-2">{text}</p></div></li>)}</ul>;
}
function PlatformActions() {
  return <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
    <Link to="/book" className={buttonVariants({ variant: 'default', className: 'whitespace-nowrap uppercase' })}><CalendarPlus aria-hidden />Book a Trip</Link>
    <Link to="/create-account" className={buttonVariants({ variant: 'secondary', className: 'whitespace-nowrap uppercase' })}><UserPlus aria-hidden />Create an Account</Link>
    <Link to="/create-account" search={{ type: 'provider' }} className={buttonVariants({ variant: 'secondary', className: 'whitespace-nowrap uppercase' })}><Network aria-hidden />Join the Provider Network</Link>
  </div>;
}
function PlatformPage() {
  return <PublicPage>
    <PageHero title={<BrandName on="blue" />} intro={<p>One peer-to-peer NEMT network. Two equally important connections.</p>} />
    <section className="mfn-section bg-ds-bg" aria-labelledby="connections-title"><div className="mfn-container">
      <Reveal><SectionHead id="connections-title" title="People connected. Businesses connected." intro="A clearer place for patients, facilities and independent transportation businesses to organize information and coordinate planned trips." /></Reveal>
      <div className="mt-9 grid gap-6 md:grid-cols-2">
        <Reveal className="h-full"><article className="h-full rounded-ds bg-ds-sky p-6 sm:p-8"><Users className="size-8 text-ds-primary" aria-hidden /><h3 className="ds-section-title mt-4 text-ds-primary">Patients & Facilities → Providers</h3><p className="ds-body-lg mt-3 text-ds-text-2">A direct starting point for a request, a linked provider and authorized trip information.</p></article></Reveal>
        <Reveal className="h-full"><article className="h-full rounded-ds bg-ds-membership p-6 sm:p-8"><ArrowLeftRight className="size-8 text-ds-primary" aria-hidden /><h3 className="ds-section-title mt-4 text-ds-primary">Provider ↔ Provider</h3><p className="ds-label mt-2 text-ds-primary">Business ↔ Contractor</p><p className="ds-body-lg mt-3 text-ds-text-2">Independent businesses coordinate through provider connections and permission-based operational tools.</p></article></Reveal>
      </div>
      <PlatformActions />
    </div></section>
    <section className="mfn-section ds-gray-canvas ds-canvas-texture" aria-labelledby="purpose-title"><div className="mfn-container grid items-center gap-8 lg:grid-cols-2">
      <img src={HOME_IMAGES.provider.src} alt={HOME_IMAGES.provider.alt} width={HOME_IMAGES.provider.w} height={HOME_IMAGES.provider.h} loading="lazy" className="aspect-[4/3] w-full rounded-ds object-cover" />
      <div><SectionHead align="left" id="purpose-title" title="Why we’re building it" intro="Trip information should not be scattered across disconnected conversations." /><p className="ds-body-lg mt-5 text-ds-text-2">Clearer communication, safe trip tracking and organized provider connections are intended to reduce repeated questions and the stress of coordinating transportation. They do not replace the provider’s responsibility to review and perform a trip.</p><Link to="/how-it-works" className="ds-label mt-5 inline-flex items-center gap-2 text-ds-link underline underline-offset-4">How It Works<ArrowRight className="size-4" aria-hidden /></Link></div>
    </div></section>
    <section className="mfn-section bg-ds-bg" aria-labelledby="benefits-title"><div className="mfn-container"><SectionHead id="benefits-title" title="A practical place to coordinate" /><div className="mt-9 grid gap-10 lg:grid-cols-2"><div><h3 className="ds-section-title text-ds-primary">For Patients & Facilities</h3><Benefits items={patientBenefits} /></div><div><h3 className="ds-section-title text-ds-primary">For Providers & Contractors</h3><Benefits items={providerBenefits} /></div></div><p className="ds-support mt-8 text-center">Referral funding, online collection, card setup and automatic communications are not activated. No referral is sent or eligible for acceptance before its authoritative funding requirements are met.</p></div></section>
    <section id="five-minute-request" className="mfn-section ds-gray-canvas ds-canvas-texture scroll-mt-24" aria-labelledby="five-minute-title"><div className="mfn-container"><SectionHead id="five-minute-title" title="Create a trip request in about five minutes" intro="An estimated form-completion time when you have the required information ready." /><ol className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-5">{steps.map(({ icon: Icon, title, text }, i) => <li key={title} className="min-w-0"><div className="flex items-center gap-3 text-ds-primary"><span className="ds-label">0{i + 1}</span><Icon className="size-6" aria-hidden /></div><h3 className="ds-subheading mt-4 text-ds-primary">{title}</h3><p className="ds-body mt-2 text-ds-text-2">{text}</p></li>)}</ol><p className="ds-body mx-auto mt-8 max-w-3xl text-center text-ds-primary">Five minutes is not a promise of provider acceptance, scheduling, pricing, approval or trip completion. Availability and acceptance are separate.</p><PlatformActions /></div></section>
    <section className="mfn-section bg-ds-bg" aria-labelledby="responsibility-title"><div className="mfn-container max-w-4xl"><SectionHead id="responsibility-title" title="Independent providers. Clear responsibilities." /><div className="ds-body-lg mt-6 space-y-4 text-ds-text-2"><p>MY FLORIDA NEMT is not a transportation provider, medical provider, broker, insurer or emergency service. It is not an open marketplace guaranteeing service.</p><p>Participating providers are independent businesses responsible for their licensing, insurance, vehicles, drivers and contractors, pricing, availability, performance and applicable legal requirements.</p><p>No availability, acceptance, Medicaid coverage, approval, savings or specific outcome is promised. For an emergency, call 911.</p></div><p className="mt-6 text-center"><Link to="/policies" className="ds-label text-ds-link underline underline-offset-4">OUR POLICIES</Link></p></div></section>
    <section className="mfn-section bg-ds-membership" aria-labelledby="start-title"><div className="mfn-container text-center"><SectionHead id="start-title" title="Start with your connection" intro="Request a planned trip or create the account that fits your role." /><PlatformActions /></div></section>
  </PublicPage>;
}
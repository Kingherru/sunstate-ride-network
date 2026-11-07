import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery, queryOptions } from '@tanstack/react-query';
import { getTripInvoice } from '@/lib/trip-invoices.functions';
import { TripInvoiceDetails } from '@/components/portal/TripInvoiceDetails';
const invoiceQuery = (id: string) => queryOptions({ queryKey: ['trip-invoice', id], queryFn: () => getTripInvoice({ data: { invoiceId: id } }) });
export const Route = createFileRoute('/_authenticated/portal/invoices/$id')({
  head: () => ({ meta: [{ title: 'Trip Invoice — MY FLORIDA NEMT Portal' }, { name: 'description', content: 'Authorized customer trip invoice, immutable charges and payment history.' }, { property: 'og:title', content: 'Trip Invoice — MY FLORIDA NEMT' }, { property: 'og:description', content: 'Private customer invoice and verified payment status.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }, { name: 'robots', content: 'noindex, nofollow' }] }),
  loader: ({ params, context }) => context.queryClient.ensureQueryData(invoiceQuery(params.id)), component: InvoicePage,
});
function InvoicePage() { const { id } = Route.useParams(); const { data } = useSuspenseQuery(invoiceQuery(id)); return <section className="mx-auto max-w-4xl"><h1 className="ds-section-title mb-5 uppercase">Trip invoice</h1>{data ? <TripInvoiceDetails invoice={data}/> : <p role="alert">Invoice unavailable.</p>}</section>; }
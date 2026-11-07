import { Html, Head, Preview, Body, Container, Heading, Text, Button } from '@react-email/components';
import type { TemplateEntry } from './registry';
function CustomerTripInvoice({ invoiceNumber, providerName, amountUsd, invoiceUrl }: Record<string, string>) {
  return <Html><Head/><Preview>Invoice {invoiceNumber} from {providerName}</Preview><Body><Container><Heading>MY FLORIDA NEMT</Heading><Text>Invoice {invoiceNumber}</Text><Text>{providerName} has sent an invoice for {amountUsd}.</Text><Button href={invoiceUrl}>View secure invoice</Button><Text>Payment does not by itself confirm transportation. Your independent provider controls trip confirmation.</Text></Container></Body></Html>;
}
export const template = { component: CustomerTripInvoice, subject: (d: Record<string, unknown>) => `Invoice ${String(d.invoiceNumber ?? '')} — MY FLORIDA NEMT`, displayName: 'Customer trip invoice' } satisfies TemplateEntry;
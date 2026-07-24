import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  tripShortId?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupDate?: string
  pickupTime?: string
  amountUsd?: string
  invoiceUrl?: string
  payUrl?: string
  siteName?: string
}

const TripAcceptedInvoice = ({
  recipientName = 'there',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  amountUsd = '$0.00',
  invoiceUrl,
  payUrl,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Trip #{tripShortId} accepted — invoice {amountUsd}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your trip has been accepted</Heading>
        <Text style={p}>Hi {recipientName},</Text>
        <Text style={p}>
          Good news — trip <strong>#{tripShortId}</strong> is approved. Please
          complete payment to finalize scheduling.
        </Text>
        <Section style={panel}>
          <Text style={label}>Amount due</Text>
          <Text style={amount}>{amountUsd}</Text>
        </Section>
        <Section style={panel}>
          <Text style={row}><strong>Date:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>Drop-off:</strong> {dropoffAddress}</Text>
        </Section>
        {payUrl && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={payUrl} style={btn}>Pay now</Button>
          </Section>
        )}
        {invoiceUrl && (
          <Text style={p}>
            <a href={invoiceUrl} style={link}>Download invoice (PDF)</a>
          </Text>
        )}
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Trip Accepted &amp; Invoice</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TripAcceptedInvoice,
  subject: (d: Record<string, any>) => `Trip #${d.tripShortId ?? ''} accepted — invoice ${d.amountUsd ?? ''}`.trim(),
  displayName: 'Trip — Accepted & Invoice',
  previewData: {
    recipientName: 'Alex',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    amountUsd: '$78.50',
    payUrl: 'https://myfloridanemt.com/pay/example',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#0b2447', margin: '4px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#64748b', margin: 0, fontWeight: 700 }
const amount = { fontSize: '26px', fontWeight: 800, color: '#0b2447', margin: '4px 0 0' }
const btn = { background: '#ea6a1f', color: '#ffffff', padding: '12px 22px', borderRadius: '4px', fontWeight: 700, textDecoration: 'none', fontSize: '15px' }
const link = { color: '#0b2447', textDecoration: 'underline' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

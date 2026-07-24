import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  providerName?: string
  tripShortId?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupDate?: string
  pickupTime?: string
  tripType?: string
  transportType?: string
  region?: string
  viewUrl?: string
  siteName?: string
}

const QuoteRequest = ({
  providerName = 'Provider',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  tripType = 'One-way',
  transportType = '',
  region = '',
  viewUrl,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New trip available for quote — #{tripShortId}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New trip available for quote</Heading>
        <Text style={p}>Hi {providerName},</Text>
        <Text style={p}>
          A new trip in {region || 'your service area'} is open for a quote. Review the
          details and submit your quote through the Provider Portal.
        </Text>
        <Section style={panel}>
          <Text style={row}><strong>Trip ID:</strong> {tripShortId}</Text>
          {transportType && <Text style={row}><strong>Transport:</strong> {transportType}</Text>}
          <Text style={row}><strong>Trip type:</strong> {tripType}</Text>
          <Text style={row}><strong>Date:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>Drop-off:</strong> {dropoffAddress}</Text>
        </Section>
        {viewUrl && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={viewUrl} style={btn}>View Trip</Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Quote requested</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: QuoteRequest,
  subject: (d: Record<string, any>) => `Quote requested — trip #${d.tripShortId ?? ''}`.trim(),
  displayName: 'Provider — Quote request',
  previewData: {
    providerName: 'Sunshine Transport',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    tripType: 'Round Trip',
    transportType: 'Wheelchair',
    region: 'Central Florida',
    viewUrl: 'https://myfloridanemt.com/dashboard?tab=requests',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#0b2447', margin: '4px 0' }
const btn = { background: '#ea6a1f', color: '#ffffff', padding: '12px 22px', borderRadius: '4px', fontWeight: 700, textDecoration: 'none', fontSize: '15px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

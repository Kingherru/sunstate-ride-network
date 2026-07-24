import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  tripShortId?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupDate?: string
  pickupTime?: string
  returnDate?: string
  returnTime?: string
  providerName?: string
  driverName?: string
  vehicleDetails?: string
  specialInstructions?: string
  supportPhone?: string
  siteName?: string
}

const TripFinalDetails = ({
  recipientName = 'there',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  returnDate,
  returnTime,
  providerName,
  driverName,
  vehicleDetails,
  specialInstructions,
  supportPhone = '(800) 555-0199',
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your trip is scheduled — #{tripShortId}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your trip is scheduled</Heading>
        <Text style={p}>Hi {recipientName},</Text>
        <Text style={p}>
          Payment received. Here are your confirmed trip details.
        </Text>
        <Section style={panel}>
          <Text style={row}><strong>Trip ID:</strong> {tripShortId}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>From:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>To:</strong> {dropoffAddress}</Text>
          {returnDate && (
            <Text style={row}><strong>Return:</strong> {returnDate}{returnTime ? ` at ${returnTime}` : ''}</Text>
          )}
        </Section>
        {(providerName || driverName || vehicleDetails) && (
          <Section style={panel}>
            {providerName && <Text style={row}><strong>Provider:</strong> {providerName}</Text>}
            {driverName && <Text style={row}><strong>Driver:</strong> {driverName}</Text>}
            {vehicleDetails && <Text style={row}><strong>Vehicle:</strong> {vehicleDetails}</Text>}
          </Section>
        )}
        {specialInstructions && (
          <Section style={panel}>
            <Text style={label}>Special instructions</Text>
            <Text style={row}>{specialInstructions}</Text>
          </Section>
        )}
        <Text style={p}>
          Need help? Call {supportPhone} — we're here 24/7.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Final Trip Details</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TripFinalDetails,
  subject: (d: Record<string, any>) => `Your trip is scheduled — #${d.tripShortId ?? ''}`.trim(),
  displayName: 'Trip — Final Details',
  previewData: {
    recipientName: 'Alex',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    returnDate: '2026-07-30',
    returnTime: '14:00',
    providerName: 'Sunshine Medical Transport',
    driverName: 'J. Rivera',
    vehicleDetails: '2023 Ford Transit — WAV',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#0b2447', margin: '4px 0' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#64748b', margin: 0, fontWeight: 700 }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

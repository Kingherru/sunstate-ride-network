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
  tripType?: string
  siteName?: string
}

const TripConfirmation = ({
  recipientName = 'there',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  tripType = 'One-way',
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Trip request received — #{tripShortId}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>We received your trip request</Heading>
        <Text style={p}>Hi {recipientName},</Text>
        <Text style={p}>
          Thanks for booking with {siteName}. A dispatcher will review the request
          shortly and follow up with confirmation and pricing.
        </Text>
        <Section style={panel}>
          <Text style={row}><strong>Trip ID:</strong> {tripShortId}</Text>
          <Text style={row}><strong>Trip type:</strong> {tripType}</Text>
          <Text style={row}><strong>Date:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>Drop-off:</strong> {dropoffAddress}</Text>
        </Section>
        <Text style={p}>
          You'll receive a second email once the trip is accepted with an invoice
          and secure payment link.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Trip Confirmation</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TripConfirmation,
  subject: (d: Record<string, any>) => `Trip request received — #${d.tripShortId ?? ''}`.trim(),
  displayName: 'Trip — Confirmation',
  previewData: {
    recipientName: 'Alex',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    tripType: 'Round Trip',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#0b2447', margin: '4px 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

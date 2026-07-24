import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  sourceLabel?: string
  tripShortId?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupDate?: string
  pickupTime?: string
  tripType?: string
  transportType?: string
  reviewUrl?: string
  siteName?: string
}

const StaffReview = ({
  recipientName = 'there',
  sourceLabel = 'A new transportation request',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  tripType = 'One-way',
  transportType,
  reviewUrl,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New trip waiting for review — #{tripShortId}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New trip waiting for review</Heading>
        <Text style={p}>Hi {recipientName},</Text>
        <Text style={p}>
          {sourceLabel} has been received and is awaiting review.
        </Text>
        <Section style={panel}>
          <Text style={row}><strong>Trip ID:</strong> {tripShortId}</Text>
          {transportType && <Text style={row}><strong>Transport:</strong> {transportType}</Text>}
          <Text style={row}><strong>Trip type:</strong> {tripType}</Text>
          <Text style={row}><strong>Date:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>Drop-off:</strong> {dropoffAddress}</Text>
        </Section>
        {reviewUrl && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={reviewUrl} style={btn}>Review Trip</Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Trip pending review</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffReview,
  subject: (d: Record<string, any>) => `New trip to review — #${d.tripShortId ?? ''}`.trim(),
  displayName: 'Staff/Provider — New trip review',
  previewData: {
    recipientName: 'Dispatch',
    sourceLabel: 'A new transportation request from a patient',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    tripType: 'Round Trip',
    transportType: 'Wheelchair',
    reviewUrl: 'https://myfloridanemt.com/admin?tab=reservations',
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

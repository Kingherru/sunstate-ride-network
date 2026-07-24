import React from 'react'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  recipientName?: string
  senderName?: string
  tripShortId?: string
  pickupAddress?: string
  dropoffAddress?: string
  pickupDate?: string
  pickupTime?: string
  tripType?: string
  offerAmountUsd?: string
  reviewUrl?: string
  siteName?: string
}

const ApprovalRequest = ({
  recipientName = 'there',
  senderName = 'A provider',
  tripShortId = '',
  pickupAddress = '',
  dropoffAddress = '',
  pickupDate = '',
  pickupTime = '',
  tripType = 'One-way',
  offerAmountUsd,
  reviewUrl,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Trip approval requested — #{tripShortId}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Trip approval requested</Heading>
        <Text style={p}>Hi {recipientName},</Text>
        <Text style={p}>
          {senderName} sent you trip <strong>#{tripShortId}</strong> for review.
          Please approve or decline through the Provider Portal.
        </Text>
        <Section style={panel}>
          <Text style={row}><strong>Trip type:</strong> {tripType}</Text>
          <Text style={row}><strong>Date:</strong> {pickupDate}{pickupTime ? ` at ${pickupTime}` : ''}</Text>
          <Text style={row}><strong>Pickup:</strong> {pickupAddress}</Text>
          <Text style={row}><strong>Drop-off:</strong> {dropoffAddress}</Text>
          {offerAmountUsd && <Text style={row}><strong>Offer:</strong> {offerAmountUsd}</Text>}
        </Section>
        {reviewUrl && (
          <Section style={{ textAlign: 'center', margin: '20px 0' }}>
            <Button href={reviewUrl} style={btn}>Review Trip</Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Referral pending your review</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ApprovalRequest,
  subject: (d: Record<string, any>) => `Approval requested — trip #${d.tripShortId ?? ''}`.trim(),
  displayName: 'Provider — Approval request',
  previewData: {
    recipientName: 'Alex',
    senderName: 'Sunshine Transport',
    tripShortId: 'MFN-20260724-000123',
    pickupAddress: '123 Main St, Orlando FL',
    dropoffAddress: '400 Hospital Way, Orlando FL',
    pickupDate: '2026-07-30',
    pickupTime: '09:15',
    tripType: 'Round Trip',
    offerAmountUsd: '$78.50',
    reviewUrl: 'https://myfloridanemt.com/dashboard?tab=requests',
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

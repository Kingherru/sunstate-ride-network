import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  providerName?: string
  amountUsd?: string
  tripShortId?: string
  availableBalanceUsd?: string
  siteName?: string
}

const FundsAvailable = ({
  providerName = 'there',
  amountUsd = '$0.00',
  tripShortId,
  availableBalanceUsd,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{amountUsd} is now available in your Provider Balance</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Funds released to your balance</Heading>
        <Text style={p}>Hi {providerName},</Text>
        <Text style={p}>
          <strong>{amountUsd}</strong>
          {tripShortId ? ` from trip #${tripShortId}` : ''} has finished the payout
          hold period and moved from pending to your available Provider Balance.
        </Text>
        {availableBalanceUsd && (
          <Section style={panel}>
            <Text style={panelLabel}>Available balance</Text>
            <Text style={panelValue}>{availableBalanceUsd}</Text>
          </Section>
        )}
        <Text style={p}>
          You can cash out anytime from the Provider Portal. Transfers arrive in
          your connected bank within 1–2 business days.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Provider Balance</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: FundsAvailable,
  subject: (d: Record<string, any>) => `${d.amountUsd ?? 'Funds'} is available to cash out`,
  displayName: 'Provider — Funds available',
  previewData: { providerName: 'Alex', amountUsd: '$142.50', tripShortId: 'a1b2c3d4', availableBalanceUsd: '$412.90' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const panelLabel = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#64748b', margin: 0, fontWeight: 700 }
const panelValue = { fontSize: '24px', fontWeight: 800, color: '#0b2447', margin: '4px 0 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

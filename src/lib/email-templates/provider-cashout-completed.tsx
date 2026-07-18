import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  providerName?: string
  amountUsd?: string
  transferId?: string
  siteName?: string
}

const CashoutCompleted = ({
  providerName = 'there',
  amountUsd = '$0.00',
  transferId,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your cash-out of {amountUsd} is on the way</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Cash-out sent</Heading>
        <Text style={p}>Hi {providerName},</Text>
        <Text style={p}>
          Your cash-out of <strong>{amountUsd}</strong> has been transferred to your
          connected bank account. Funds typically arrive within 1–2 business days.
        </Text>
        {transferId && (
          <Section style={panel}>
            <Text style={panelLabel}>Transfer reference</Text>
            <Text style={panelValueSm}>{transferId}</Text>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Provider Balance</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CashoutCompleted,
  subject: (d: Record<string, any>) => `Cash-out sent — ${d.amountUsd ?? ''}`.trim(),
  displayName: 'Provider — Cash-out completed',
  previewData: { providerName: 'Alex', amountUsd: '$412.90', transferId: 'tr_1AbCdEfGh' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#0b2447' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#f4f7fb', borderRadius: '4px', padding: '12px 14px', margin: '16px 0' }
const panelLabel = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#64748b', margin: 0, fontWeight: 700 }
const panelValueSm = { fontSize: '13px', color: '#0b2447', margin: '4px 0 0', fontFamily: 'monospace' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

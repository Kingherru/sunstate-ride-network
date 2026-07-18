import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Hr } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  providerName?: string
  amountUsd?: string
  reason?: string
  siteName?: string
}

const CashoutFailed = ({
  providerName = 'there',
  amountUsd = '$0.00',
  reason,
  siteName = 'My Florida NEMT',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your cash-out of {amountUsd} could not be sent</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Cash-out failed</Heading>
        <Text style={p}>Hi {providerName},</Text>
        <Text style={p}>
          We were unable to send your cash-out of <strong>{amountUsd}</strong>. The
          funds have been returned to your available Provider Balance so you can try
          again after resolving the issue below.
        </Text>
        {reason && (
          <Section style={panel}>
            <Text style={panelLabel}>Reason</Text>
            <Text style={panelValueSm}>{reason}</Text>
          </Section>
        )}
        <Text style={p}>
          Common fixes: reconnect your Stripe payout account, verify your bank
          details, or contact support.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>{siteName} — Provider Balance</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: CashoutFailed,
  subject: (d: Record<string, any>) => `Cash-out failed — ${d.amountUsd ?? ''}`.trim(),
  displayName: 'Provider — Cash-out failed',
  previewData: { providerName: 'Alex', amountUsd: '$412.90', reason: 'Provider Stripe account not active' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#b91c1c' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#1a1a1a', margin: '10px 0' }
const panel = { background: '#fef2f2', borderRadius: '4px', padding: '12px 14px', margin: '16px 0', borderLeft: '3px solid #b91c1c' }
const panelLabel = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#991b1b', margin: 0, fontWeight: 700 }
const panelValueSm = { fontSize: '13px', color: '#1a1a1a', margin: '4px 0 0' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#64748b' }

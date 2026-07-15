import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  driverName?: string
  periodLabel?: string
  siteName?: string
  senderName?: string
  senderNote?: string
  completedTrips?: number
  pickupLegs?: number
  totalMiles?: number
  waitMinutes?: number
  cancellations?: number
  workedHours?: number
  workedDays?: number
  grossUsd?: string
  adjustmentsUsd?: string
  amountPaidUsd?: string
  outstandingUsd?: string
}

const money = (v?: string) => v ?? '$0.00'
const num = (n?: number) => (n == null ? '0' : String(n))

const DriverEarningsReport = ({
  driverName = 'Driver',
  periodLabel = '—',
  siteName = 'My Florida NEMT',
  senderName,
  senderNote,
  completedTrips,
  pickupLegs,
  totalMiles,
  waitMinutes,
  cancellations,
  workedHours,
  workedDays,
  grossUsd,
  adjustmentsUsd,
  amountPaidUsd,
  outstandingUsd,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your earnings statement for {periodLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Earnings statement</Heading>
        <Text style={sub}>
          {periodLabel} · Prepared for {driverName}
        </Text>

        {senderNote ? (
          <Section style={noteBox}>
            <Text style={noteText}>{senderNote}</Text>
          </Section>
        ) : null}

        <Section style={panel}>
          <Heading as="h2" style={h2}>Trip activity</Heading>
          <Row label="Completed trips" value={num(completedTrips)} />
          <Row label="Pickup legs" value={num(pickupLegs)} />
          <Row label="Total miles" value={totalMiles != null ? totalMiles.toFixed(1) : '0.0'} />
          <Row label="Wait time (minutes)" value={num(waitMinutes)} />
          <Row label="Cancellations" value={num(cancellations)} />
          <Row label="Hours worked" value={workedHours != null ? workedHours.toFixed(2) : '0.00'} />
          <Row label="Days worked" value={num(workedDays)} />
        </Section>

        <Section style={panel}>
          <Heading as="h2" style={h2}>Payment summary</Heading>
          <Row label="Gross earnings" value={money(grossUsd)} />
          <Row label="Adjustments" value={money(adjustmentsUsd)} />
          <Row label="Amount paid" value={money(amountPaidUsd)} />
          <Hr style={hr} />
          <Row label="Remaining balance" value={money(outstandingUsd)} bold />
        </Section>

        <Text style={footer}>
          Sent by {senderName || siteName}. A PDF copy of this statement is also available from
          {' '}your provider. If you have any questions, reply to this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', margin: '4px 0' }}>
      <tbody>
        <tr>
          <td style={{ ...rowLabel, ...(bold ? rowBold : {}) }}>{label}</td>
          <td style={{ ...rowValue, ...(bold ? rowBold : {}) }}>{value}</td>
        </tr>
      </tbody>
    </table>
  )
}

export const template = {
  component: DriverEarningsReport,
  subject: (data: Record<string, any>) =>
    `Earnings statement — ${data?.periodLabel ?? 'recent period'}`,
  displayName: 'Driver earnings report',
  previewData: {
    driverName: 'Jane Doe',
    periodLabel: 'Nov 1 – Nov 15, 2026',
    completedTrips: 42,
    pickupLegs: 60,
    totalMiles: 512.4,
    waitMinutes: 85,
    cancellations: 2,
    workedHours: 78.5,
    workedDays: 11,
    grossUsd: '$1,245.00',
    adjustmentsUsd: '$25.00',
    amountPaidUsd: '$800.00',
    outstandingUsd: '$470.00',
    senderName: 'My Florida NEMT',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', color: '#0f172a' }
const container = { padding: '28px 28px', maxWidth: '600px' }
const h1 = { fontSize: '22px', margin: '0 0 4px 0', color: '#0b2545' }
const h2 = { fontSize: '14px', margin: '0 0 8px 0', color: '#0b2545', textTransform: 'uppercase' as const, letterSpacing: '0.08em' }
const sub = { fontSize: '13px', margin: '0 0 20px 0', color: '#475569' }
const panel = { border: '1px solid #e2e8f0', borderRadius: '4px', padding: '16px 18px', marginBottom: '14px' }
const noteBox = { backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '12px 14px', margin: '0 0 16px 0' }
const noteText = { fontSize: '13px', color: '#334155', margin: 0, whiteSpace: 'pre-wrap' as const }
const rowLabel = { fontSize: '13px', color: '#475569', padding: '3px 0' }
const rowValue = { fontSize: '13px', color: '#0f172a', padding: '3px 0', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const }
const rowBold = { fontWeight: 700 as const, color: '#0b2545' }
const hr = { borderColor: '#e2e8f0', margin: '10px 0' }
const footer = { fontSize: '12px', color: '#64748b', marginTop: '20px' }

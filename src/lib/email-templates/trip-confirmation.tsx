import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

/**
 * Requester confirmation. PRIVACY: this template intentionally accepts only
 * the short request number and status. Never add addresses, dates, times,
 * mobility/medical details, notes or delivery instructions.
 */
interface Props {
  tripShortId?: string
  status?: string
}

const TripConfirmation = ({ tripShortId = '', status = 'Received — under review' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your request</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MY FLORIDA <span style={{ color: '#E07A1F' }}>NEMT</span></Text>
        <Heading style={h1}>We received your request</Heading>
        <Section style={panel}>
          <Text style={row}><strong>Request number:</strong> {tripShortId}</Text>
          <Text style={row}><strong>Status:</strong> {status}</Text>
        </Section>
        <Text style={p}>
          Your request was received for review. Submitting a request does not guarantee
          availability or acceptance. A participating provider must review and accept it first.
        </Text>
        <Text style={p}>
          For questions, reply to this email or call us using the number on our website.
          Please reference your request number. Do not send medical information by email.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>MY FLORIDA NEMT — non-emergency transportation. In an emergency, call 911.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TripConfirmation,
  subject: 'We received your request — MY FLORIDA NEMT',
  displayName: 'Request — Received',
  previewData: { tripShortId: '1A2B3C4D', status: 'Received — under review' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brand = { fontSize: '14px', fontWeight: 700, letterSpacing: '0.08em', color: '#13335A', margin: '0 0 12px' }
const h1 = { fontSize: '22px', margin: '0 0 12px', color: '#13335A' }
const p = { fontSize: '14px', lineHeight: '22px', color: '#18202A', margin: '10px 0' }
const panel = { background: '#F3F7FB', borderRadius: '4px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '13px', color: '#13335A', margin: '4px 0' }
const hr = { borderColor: '#DCE1E6', margin: '20px 0' }
const muted = { fontSize: '12px', color: '#55616F' }

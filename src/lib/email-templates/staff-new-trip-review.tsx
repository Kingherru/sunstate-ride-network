import React from 'react'
import { Body, Container, Head, Heading, Hr, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

/**
 * Staff/admin notice. PRIVACY: only the short request number and category.
 * No addresses, trip details, medical information, instructions, or links
 * carrying tokens or request IDs.
 */
interface Props {
  tripShortId?: string
  requestCategory?: string
}

const StaffReview = ({ tripShortId = '', requestCategory = 'Passenger Transportation' }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>A new request requires secure review</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>MY FLORIDA <span style={{ color: '#E07A1F' }}>NEMT</span></Text>
        <Heading style={h1}>New request requires secure review</Heading>
        <Section style={panel}>
          <Text style={row}><strong>Request number:</strong> {tripShortId}</Text>
          <Text style={row}><strong>Category:</strong> {requestCategory}</Text>
        </Section>
        <Text style={p}>
          Sign in to your authorized MY FLORIDA NEMT workspace to review the request details.
          Request details are available only after secure sign-in.
        </Text>
        <Hr style={hr} />
        <Text style={muted}>MY FLORIDA NEMT — internal notice</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StaffReview,
  subject: 'New request requires review — MY FLORIDA NEMT',
  displayName: 'Staff — New request review',
  previewData: { tripShortId: '1A2B3C4D', requestCategory: 'Medical Delivery' },
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

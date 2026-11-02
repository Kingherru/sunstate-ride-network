import React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from '@react-email/components'
import type { TemplateEntry } from './registry'

type Trip = { date?: string; time?: string | null; reference?: string; pickup?: string; destination?: string }
interface Props { driverName?: string; periodLabel?: string; trips?: Trip[] }

/** Operational schedule only: no diagnosis, billing, payment, notes, documents or other passengers. */
const DriverSchedule = ({ driverName = 'Driver', periodLabel = 'Upcoming', trips = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your MY FLORIDA NEMT trip schedule for {periodLabel}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Your trip schedule</Heading>
        <Text style={sub}>{periodLabel} · Prepared for {driverName}</Text>
        <Section style={panel}>
          {trips.length === 0 ? <Text style={row}>No assigned trips in this period.</Text> : trips.map((t, i) => (
            <Text key={i} style={row}><strong>{t.date} {t.time ?? 'Time not provided'}</strong> · {t.reference}<br />{t.pickup || 'Pickup not provided'} → {t.destination || 'Destination not provided'}</Text>
          ))}
        </Section>
        <Text style={foot}>Open the MY FLORIDA NEMT portal for full assigned trip details.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DriverSchedule,
  subject: (d: Record<string, any>) => `Your trip schedule — ${d.periodLabel ?? 'upcoming'}`,
  displayName: 'Driver schedule',
  previewData: { driverName: 'Jordan', periodLabel: 'Mar 3 – Mar 9', trips: [{ date: '2026-03-03', time: '08:30', reference: 'A1B2C3D4', pickup: '100 Main St, Tampa', destination: 'Clinic, Tampa' }] },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 24px', maxWidth: '600px' }
const h1 = { color: '#13335A', fontSize: '22px', margin: '0 0 6px' }
const sub = { color: '#4a5568', fontSize: '14px', margin: '0 0 18px' }
const panel = { backgroundColor: '#F3F7FB', borderRadius: '5px', padding: '12px 16px' }
const row = { color: '#13335A', fontSize: '14px', lineHeight: '20px', margin: '0 0 10px' }
const foot = { color: '#4a5568', fontSize: '12px', marginTop: '18px' }

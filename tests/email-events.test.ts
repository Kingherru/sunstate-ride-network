import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ previous: null as null | { id: string }, readError: null as null | { code: string }, writes: [] as Array<{ table: string; row: any }>, writeError: null as null | { code: string } }))
vi.mock('../src/integrations/supabase/client.server', () => ({ supabaseAdmin: {
  from: (table: string) => ({
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.previous, error: mocks.readError }) }) }),
    upsert: async (row: any) => { mocks.writes.push({ table, row }); return { error: mocks.writeError } },
  }),
} }))
import { recordEmailOutcome } from '../src/lib/email-templates/email-audit.server'

describe('signed email outcome persistence', () => {
  beforeEach(() => { mocks.previous = null; mocks.readError = null; mocks.writeError = null; mocks.writes = [] })
  const event = (type: 'email.bounced' | 'email.complaint' | 'email.unsubscribed') => ({
    event_id: 'delivery-1', run_id: 'run-1', type, project_id: 'unit-test', environment: 'prod' as const,
    timestamp: '2026-10-25T00:00:00Z', version: '1', data: { event: type, recipient: 'Person@Example.invalid', message_id: 'mail-1' },
  })
  it.each([
    ['email.bounced', 'bounce', 'bounced'],
    ['email.complaint', 'complaint', 'complained'],
    ['email.unsubscribed', 'unsubscribe', 'suppressed'],
  ] as const)('preserves legacy constraint values for %s', async (type, reason, status) => {
    await recordEmailOutcome(event(type))
    expect(mocks.writes[0]).toEqual({ table: 'suppressed_emails', row: { email: 'person@example.invalid', reason, metadata: null } })
    expect(mocks.writes[1].row).toMatchObject({ template_name: 'system', recipient_email: 'person@example.invalid', status, message_id: 'mail-1', metadata: null })
  })
  it('ignores an already recorded delivery', async () => {
    mocks.previous = { id: 'recorded' }
    await recordEmailOutcome(event('email.bounced'))
    expect(mocks.writes).toHaveLength(0)
  })
  it('uses the same durable log identity on redelivery', async () => {
    await recordEmailOutcome(event('email.bounced'))
    const first = mocks.writes[1].row.id
    await recordEmailOutcome(event('email.bounced'))
    expect(mocks.writes[3].row.id).toBe(first)
  })
  it('throws on rejected writes so delivery can retry', async () => {
    mocks.writeError = { code: 'constraint' }
    await expect(recordEmailOutcome(event('email.bounced'))).rejects.toThrow('constraint')
  })
})
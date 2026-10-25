import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ send: vi.fn(), audit: vi.fn(), render: vi.fn().mockResolvedValue('rendered') }))
vi.mock('@lovable.dev/email-js', () => ({
  sendLovableEmail: mocks.send,
  EmailAPIError: class extends Error { code = 'recipient_suppressed' },
}))
vi.mock('@react-email/render', () => ({ render: mocks.render }))
vi.mock('../src/lib/email-templates/registry', () => ({ TEMPLATES: { notice: { component: () => null, subject: 'Notice', to: 'fixed@example.invalid' } } }))
vi.mock('../src/lib/email-templates/email-audit.server', () => ({ recordSendOutcome: mocks.audit }))
import { sendTemplateEmail } from '../src/lib/email-templates/send-email'
import { EmailAPIError } from '@lovable.dev/email-js'

describe('managed email outcomes', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.LOVABLE_API_KEY = 'unit-test-only'; mocks.send.mockResolvedValue({}); mocks.audit.mockResolvedValue(undefined) })
  it('preserves the fixed recipient and event idempotency key', async () => {
    await expect(sendTemplateEmail('notice', 'caller@example.invalid', { idempotencyKey: 'notice-event-1' })).resolves.toEqual({ sent: true })
    expect(mocks.send.mock.calls[0][0]).toMatchObject({ to: 'fixed@example.invalid', idempotency_key: 'notice-event-1', purpose: 'transactional', sender_domain: 'notify.myfloridanemt.com' })
    expect(mocks.audit).toHaveBeenCalledWith('notice', 'fixed@example.invalid', 'sent')
  })
  it('treats suppression as a normal outcome and never retries', async () => {
    mocks.send.mockRejectedValue(new EmailAPIError('suppressed') as Error)
    await expect(sendTemplateEmail('notice', 'caller@example.invalid')).resolves.toEqual({ sent: false, reason: 'recipient_suppressed' })
    expect(mocks.send).toHaveBeenCalledTimes(1)
    expect(mocks.audit).toHaveBeenCalledWith('notice', 'fixed@example.invalid', 'suppressed')
  })
  it('records failures without converting them to success', async () => {
    mocks.send.mockRejectedValue(new Error('send failed'))
    await expect(sendTemplateEmail('notice', 'caller@example.invalid')).rejects.toThrow('send failed')
    expect(mocks.audit).toHaveBeenCalledWith('notice', 'fixed@example.invalid', 'failed', 'send failed')
  })
})
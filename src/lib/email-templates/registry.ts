import type { ComponentType } from 'react'
import { template as driverEarningsReport } from './driver-earnings-report'
import { template as providerFundsAvailable } from './provider-funds-available'
import { template as providerCashoutCompleted } from './provider-cashout-completed'
import { template as providerCashoutFailed } from './provider-cashout-failed'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'driver-earnings-report': driverEarningsReport,
  'provider-funds-available': providerFundsAvailable,
  'provider-cashout-completed': providerCashoutCompleted,
  'provider-cashout-failed': providerCashoutFailed,
}

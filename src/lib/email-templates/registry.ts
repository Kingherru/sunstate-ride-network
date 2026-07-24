import type { ComponentType } from 'react'
import { template as driverEarningsReport } from './driver-earnings-report'
import { template as providerFundsAvailable } from './provider-funds-available'
import { template as providerCashoutCompleted } from './provider-cashout-completed'
import { template as providerCashoutFailed } from './provider-cashout-failed'
import { template as tripConfirmation } from './trip-confirmation'
import { template as tripAcceptedInvoice } from './trip-accepted-invoice'
import { template as tripFinalDetails } from './trip-final-details'
import { template as providerQuoteRequest } from './provider-quote-request'
import { template as providerApprovalRequest } from './provider-approval-request'
import { template as staffNewTripReview } from './staff-new-trip-review'

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
  'trip-confirmation': tripConfirmation,
  'trip-accepted-invoice': tripAcceptedInvoice,
  'trip-final-details': tripFinalDetails,
  'provider-quote-request': providerQuoteRequest,
  'provider-approval-request': providerApprovalRequest,
  'staff-new-trip-review': staffNewTripReview,
}

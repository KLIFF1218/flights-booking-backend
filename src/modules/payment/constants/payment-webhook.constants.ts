export const WEBHOOK_PROCESSING_OUTCOME = {
  AUTHORIZED: 'authorized',
  CONFIRMED: 'confirmed',
  SKIPPED_UNPAYABLE: 'skipped_unpayable',
  SKIPPED_BOOKING_STATE: 'skipped_booking_state',
  LATE_SUCCESS_REFUNDED: 'late_success_refunded',
  FAILED: 'failed',
  CANCELED: 'canceled',
  NOOP: 'noop',
} as const;

export type WebhookProcessingOutcome =
  (typeof WEBHOOK_PROCESSING_OUTCOME)[keyof typeof WEBHOOK_PROCESSING_OUTCOME];

export const PAYMENT_FAILURE_REASON = {
  PAYMENT_FAILED: 'payment_failed',
  PAYMENT_CANCELED: 'payment_canceled',
} as const;

export type PaymentFailureReason =
  (typeof PAYMENT_FAILURE_REASON)[keyof typeof PAYMENT_FAILURE_REASON];

export const LATE_SUCCESS_RECONCILIATION_REASON = 'late_success_after_expiration';

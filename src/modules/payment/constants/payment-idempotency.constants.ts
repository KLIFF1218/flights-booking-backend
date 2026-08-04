export const PAYMENT_WEBHOOK_IDEMPOTENCY_OPERATION = 'payment-webhook';

/** Dedupe duplicate provider events (e.g. Stripe checkout.session + payment_intent.succeeded). */
export function buildPaymentWebhookIdempotencyKey(transactionId: string, status: string): string {
  return `${transactionId}:${status}`;
}

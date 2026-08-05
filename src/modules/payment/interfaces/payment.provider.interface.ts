import type { Currency, PaymentProvider } from '@prisma/client';
import type { PaymentWebhookResult } from './payment-webhook-result.dto';

export interface PaymentWebhookIngressContext {
  ip?: string;
  rawBody?: Buffer;
  stripeSignature?: string;
}

export interface PaymentCreateParams {
  transactionId: string;
  bookingId: string;
  amount: number;
  currency: Currency;
  idempotencyKey: string;
}

export interface PaymentCreateResult {
  externalId: string;
  redirectUrl: string;
  meta?: unknown;
}

export interface PaymentProviderAdapter {
  readonly provider: PaymentProvider;

  createPayment(params: PaymentCreateParams): Promise<PaymentCreateResult>;

  getPendingPaymentRedirectUrl(externalId: string): Promise<string | null>;

  cancelPendingPayment(externalId: string): Promise<void>;

  refundPayment(paymentId: string, idempotencyKey?: string): Promise<void>;

  /** Two-stage providers (YooKassa): capture after AUTHORIZED is stored locally. */
  captureAuthorizedPayment?(externalId: string): Promise<void>;

  verifyWebhookIngress?(context: PaymentWebhookIngressContext): void;

  parseWebhookIngress?(context: PaymentWebhookIngressContext): Promise<unknown>;

  handleWebhook?(payload: unknown): Promise<PaymentWebhookResult | null>;
}

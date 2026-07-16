import type { Currency } from '@prisma/client';
import type { PaymentWebhookResult } from './payment-webhook-result.dto';

export interface PaymentProviderAdapter {
  createPayment(params: {
    transactionId: string;
    amount: number;
    currency: Currency;
    idempotencyKey: string;
  }): Promise<{
    externalId: string;
    redirectUrl: string;
    meta?: unknown;
  }>;

  handleWebhook?(payload: unknown): Promise<PaymentWebhookResult | null>;
}

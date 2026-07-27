import type { PaymentProvider, TransactionStatus } from '@prisma/client';

export interface PaymentWebhookResult {
  transactionId: string;
  bookingId: string;
  paymentId: string;

  provider: PaymentProvider;

  eventId: string;

  status: TransactionStatus;

  /** Low-cardinality payment method (e.g. bank_card, card). */
  method?: string;
}

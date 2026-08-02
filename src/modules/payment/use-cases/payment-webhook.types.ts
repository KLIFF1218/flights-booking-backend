import type { BookingStatus, PaymentProvider, Prisma, TransactionStatus } from '@prisma/client';
import type { WebhookProcessingOutcome } from '../constants/payment-webhook.constants';

export type PaymentWebhookDbClient = Prisma.TransactionClient;

export interface PaymentWebhookTransactionContext {
  id: string;
  bookingId: string;
  amount: Prisma.Decimal;
  status: TransactionStatus;
  providerMeta: unknown;
  booking: {
    id: string;
    userId: string;
    status: BookingStatus;
    snapshot: unknown;
  };
}

export interface PaymentWebhookCommand {
  transactionId: string;
  paymentId: string;
  provider: PaymentProvider;
  method?: string;
  occurredAt: string;
}

export type { WebhookProcessingOutcome };

export interface WebhookSideEffects {
  invalidateBookingId?: string;
  invalidateUserId?: string;
  outcome?: WebhookProcessingOutcome;
  needsLateSuccessReconciliation?: boolean;
}

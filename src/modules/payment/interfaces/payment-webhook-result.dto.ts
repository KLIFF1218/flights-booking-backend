import { type TransactionStatus } from '@prisma/client';

export interface PaymentWebhookResult {
  transactionId: string;
  bookingId: string;
  paymentId: string;
  status: TransactionStatus;
}

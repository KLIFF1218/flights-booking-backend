import { Injectable } from '@nestjs/common';
import { PaymentProvider, TransactionStatus } from '@prisma/client';
import { PaymentAbandonmentService } from '../services/payment-abandonment.service';

export type PaymentPendingCancelOutboxPayload = {
  transactionId: string;
  provider: PaymentProvider;
  externalId: string | null;
};

@Injectable()
export class PaymentPendingCancelOutboxHandler {
  constructor(private readonly paymentAbandonmentService: PaymentAbandonmentService) {}

  async handle(payload: PaymentPendingCancelOutboxPayload): Promise<void> {
    await this.paymentAbandonmentService.cancelPendingPaymentAtProviderBestEffort({
      id: payload.transactionId,
      status: TransactionStatus.PENDING,
      provider: payload.provider,
      externalId: payload.externalId,
    });
  }
}

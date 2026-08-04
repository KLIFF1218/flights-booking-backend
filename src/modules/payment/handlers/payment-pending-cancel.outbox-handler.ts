import { Injectable } from '@nestjs/common';
import { PaymentProvider } from '@prisma/client';
import { PaymentProviderService } from '../services/payment-provider.service';

export type PaymentPendingCancelOutboxPayload = {
  transactionId: string;
  provider: PaymentProvider;
  externalId: string | null;
};

@Injectable()
export class PaymentPendingCancelOutboxHandler {
  constructor(private readonly paymentProviderService: PaymentProviderService) {}

  async handle(payload: PaymentPendingCancelOutboxPayload): Promise<void> {
    if (!payload.externalId) {
      return;
    }

    await this.paymentProviderService.cancelPendingPaymentBestEffort(
      payload.provider,
      payload.externalId,
      { transactionId: payload.transactionId },
    );
  }
}
